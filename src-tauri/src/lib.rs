use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use cairn_app::{Engine, Event as AppEvent, EventSink};
use cairn_contract::{Command, CommandResponse, ContractError, Query, QueryResponse};
use cairn_infra::{GitVcs, InMemoryIndex, LocalFsStore, NullRuntime, TauConfig, TauServeRuntime};
use cairn_ports::{AgentEvent, AgentRuntime, AgentSink};
use cairn_service::{
    app_event_to_wire, augmented_answer, dispatch_command, dispatch_query, ServiceError,
};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

/// The concrete engine the desktop app runs. `Engine` is non-generic (its ports
/// are boxed internally); the concrete adapters are pinned by `open_engine`.
type CairnEngine = Engine;

/// Shared app state: the engine + its path behind a single mutex (None until a
/// cairn is opened).  `Clone` lets us move the `Arc` into `spawn_blocking`.
#[derive(Clone, Default)]
struct CairnState {
    inner: Arc<Mutex<Option<(CairnEngine, PathBuf)>>>,
}

/// An `EventSink` that forwards engine events to the webview as wire events.
struct TauriSink<R: Runtime>(AppHandle<R>);
impl<R: Runtime> EventSink for TauriSink<R> {
    fn emit(&mut self, event: AppEvent) {
        let _ = self.0.emit("cairn://event", app_event_to_wire(event));
    }
}

/// Build (or open) an engine rooted at `dir`, creating the git repo if needed.
fn open_engine(dir: &Path) -> Result<CairnEngine, ServiceError> {
    // `PortError` auto-converts to `ServiceError` via `?` (From impl).
    let store = LocalFsStore::open(dir)?;
    let vcs = GitVcs::open_or_init(dir)?;
    Ok(Engine::new(store, InMemoryIndex::default(), vcs))
}

fn run_command_blocking<R: Runtime>(
    state: &CairnState,
    app: &AppHandle<R>,
    command: &Command,
) -> Result<CommandResponse, ServiceError> {
    let mut guard = state.inner.lock().expect("engine mutex poisoned");
    let (engine, _path) = guard
        .as_mut()
        .ok_or_else(|| ServiceError::InvalidRequest("no cairn open".into()))?;
    let mut sink = TauriSink(app.clone());
    dispatch_command(engine, command, &mut sink)
}

fn run_query_blocking(state: &CairnState, query: &Query) -> Result<QueryResponse, ServiceError> {
    let guard = state.inner.lock().expect("engine mutex poisoned");
    let (engine, _path) = guard
        .as_ref()
        .ok_or_else(|| ServiceError::InvalidRequest("no cairn open".into()))?;
    dispatch_query(engine, query)
}

#[tauri::command]
async fn send_command<R: Runtime>(
    state: State<'_, CairnState>,
    app: AppHandle<R>,
    command: Command,
) -> Result<CommandResponse, ContractError> {
    let state = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_command_blocking(&state, &app, &command).map_err(ContractError::from)
    })
    .await
    .map_err(|e| ContractError::Internal {
        message: e.to_string(),
    })?
}

// No R: Runtime generic — queries are read-only and never emit events.
#[tauri::command]
async fn run_query(
    state: State<'_, CairnState>,
    query: Query,
) -> Result<QueryResponse, ContractError> {
    let state = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_query_blocking(&state, &query).map_err(ContractError::from)
    })
    .await
    .map_err(|e| ContractError::Internal {
        message: e.to_string(),
    })?
}

/// One increment of an agent answer, in the shape the webview's local
/// `AgentEvent` (web/src/client/agent.ts) expects. The desktop app talks to the
/// engine in-process, so it serializes the *port* `cairn_ports::AgentEvent`
/// straight to the webview rather than going through the wire `AnswerEvent`
/// (which only the daemon transport uses). Citations are not a variant: the
/// agent embeds cited notes as `[[stem]]` wikilinks inside `text_delta` text.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AgentEventPayload {
    TextDelta { text: String },
    ToolStarted { tool: String },
    ToolCompleted { tool: String, ok: bool },
    TurnCompleted,
    Completed,
    Failed { message: String },
}

/// Map a port [`AgentEvent`] to its webview payload. `None` for kinds with no
/// payload form — `AgentEvent` is `#[non_exhaustive]`, so unknown upstream kinds
/// are dropped rather than panicking (mirroring the service's wire mapper).
fn payload_of(e: AgentEvent) -> Option<AgentEventPayload> {
    match e {
        AgentEvent::TextDelta(text) => Some(AgentEventPayload::TextDelta { text }),
        AgentEvent::ToolStarted { tool } => Some(AgentEventPayload::ToolStarted { tool }),
        AgentEvent::ToolCompleted { tool, ok } => {
            Some(AgentEventPayload::ToolCompleted { tool, ok })
        }
        AgentEvent::TurnCompleted => Some(AgentEventPayload::TurnCompleted),
        AgentEvent::Completed => Some(AgentEventPayload::Completed),
        AgentEvent::Failed { message } => Some(AgentEventPayload::Failed { message }),
        _ => None,
    }
}

/// An [`AgentSink`] that forwards each mapped increment to the webview over a
/// Tauri IPC channel. A dead channel (the webview unsubscribed) just drops sends.
struct ChannelSink {
    channel: Channel<AgentEventPayload>,
}
impl AgentSink for ChannelSink {
    fn emit(&mut self, event: AgentEvent) {
        if let Some(payload) = payload_of(event) {
            let _ = self.channel.send(payload);
        }
    }
}

/// The agent runtime backing `ask`: tau when `TAU_BIN` is configured, else
/// `NullRuntime` (which errors before any event). Mirrors the daemon's wiring.
fn ask_runtime() -> Box<dyn AgentRuntime + Send + Sync> {
    match TauConfig::from_env() {
        Some(cfg) => Box::new(TauServeRuntime::new(cfg)),
        None => Box::new(NullRuntime),
    }
}

/// Flatten a pre-stream [`ServiceError`] into a human message for a `failed`
/// frame (mirrors the webview's `errMsg` formatting of a `ContractError`).
fn ask_error_message(e: ServiceError) -> String {
    match ContractError::from(e) {
        ContractError::NotFound { what } => format!("not found: {what}"),
        ContractError::InvalidRequest { message } | ContractError::Internal { message } => message,
    }
}

/// `ask`: stream a note-grounded answer to `question` over `on_event`.
///
/// Runs the whole answer in a blocking task (the agent run spawns a subprocess
/// and takes seconds). The engine mutex is held for the run's duration because
/// `augmented_answer` bundles context-gathering with streaming; the lock-minimal
/// gather/stream split lands once the engine exposes `gather_answer_context` on
/// the remote (it is currently only on an unpushed branch). A run that fails
/// *before* streaming (e.g. no `TAU_BIN`) is reported as an inline `failed`
/// frame — matching the daemon and the mock — rather than rejecting the call.
#[tauri::command]
async fn ask(
    state: State<'_, CairnState>,
    question: String,
    on_event: Channel<AgentEventPayload>,
) -> Result<(), ContractError> {
    let state = (*state).clone();
    let runtime = ask_runtime();
    tauri::async_runtime::spawn_blocking(move || {
        let guard = state.inner.lock().expect("engine mutex poisoned");
        let (engine, _path) = guard
            .as_ref()
            .ok_or_else(|| ContractError::InvalidRequest {
                message: "no cairn open".into(),
            })?;
        let mut sink = ChannelSink {
            channel: on_event.clone(),
        };
        // Default top_k of 5 mirrors the engine's `AskRequest` default.
        if let Err(e) = augmented_answer(engine, &question, runtime.as_ref(), &mut sink, 5) {
            let _ = on_event.send(AgentEventPayload::Failed {
                message: ask_error_message(e),
            });
        }
        Ok::<(), ContractError>(())
    })
    .await
    .map_err(|e| ContractError::Internal {
        message: e.to_string(),
    })?
}

/// Open a cairn at `dir`: build the engine, reindex (emitting events), record
/// engine+path atomically in state, and persist the path for next launch.
fn open_at<R: Runtime>(
    state: &CairnState,
    app: &AppHandle<R>,
    dir: &Path,
) -> Result<(), ServiceError> {
    let mut engine = open_engine(dir)?;
    let mut sink = TauriSink(app.clone());
    engine.reindex(&mut sink)?; // PortError → ServiceError via `?`
    *state.inner.lock().expect("engine mutex poisoned") = Some((engine, dir.to_path_buf()));
    if let Err(e) = persist_path(app, dir) {
        eprintln!("cairn: failed to persist cairn path: {e}"); // non-fatal
    }
    // Scope the asset protocol to exactly this cairn dir so local note images
    // (asset://) can load (S4). The static config scope is empty; this is the
    // only widening, and only ever to a user-chosen cairn root — never $APP or
    // home. Grants are additive across opens (Tauri's scope API has no per-open
    // reset), so a prior cairn's dir stays readable for the process lifetime;
    // acceptable since every grant is a directory the user explicitly opened.
    // Best-effort: a failure only means images won't render, never that opening
    // fails.
    if let Err(e) = app.asset_protocol_scope().allow_directory(dir, true) {
        eprintln!("cairn: failed to scope asset protocol to {dir:?}: {e}");
    }
    Ok(())
}

fn config_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("last-cairn.txt"))
}

fn persist_path<R: Runtime>(app: &AppHandle<R>, dir: &Path) -> std::io::Result<()> {
    let Some(f) = config_file(app) else {
        return Ok(());
    };
    if let Some(parent) = f.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let s = dir.to_str().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "path is not valid UTF-8")
    })?;
    std::fs::write(f, s.as_bytes())
}

fn last_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let f = config_file(app)?;
    let s = std::fs::read_to_string(f).ok()?;
    let p = PathBuf::from(s.trim());
    p.is_dir().then_some(p)
}

#[tauri::command]
async fn pick_and_open_cairn<R: Runtime>(
    state: State<'_, CairnState>,
    app: AppHandle<R>,
) -> Result<Option<String>, ContractError> {
    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;
        let Some(folder) = app.dialog().file().blocking_pick_folder() else {
            return Ok(None);
        };
        let dir = folder.into_path().map_err(|e| ContractError::Internal {
            message: e.to_string(),
        })?;
        let state = (*state).clone();
        let app2 = app.clone();
        let dir2 = dir.clone();
        tauri::async_runtime::spawn_blocking(move || {
            open_at(&state, &app2, &dir2).map_err(ContractError::from)
        })
        .await
        .map_err(|e| ContractError::Internal {
            message: e.to_string(),
        })??;
        Ok(Some(dir.to_string_lossy().into_owned()))
    }
    #[cfg(mobile)]
    {
        // Mobile open-a-cairn (document picker / SAF + git-on-device) is deferred.
        let _ = (&state, &app);
        Ok(None)
    }
}

#[tauri::command]
fn current_cairn(state: State<'_, CairnState>) -> Option<String> {
    state
        .inner
        .lock()
        .expect("engine mutex poisoned")
        .as_ref()
        .map(|(_, p)| p.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CairnState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(dir) = last_path(&handle) {
                let state = app.state::<CairnState>();
                let _ = open_at(&state, &handle, &dir); // best-effort; empty state on failure
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_command,
            run_query,
            ask,
            pick_and_open_cairn,
            current_cairn
        ])
        .run(tauri::generate_context!())
        .expect("error while running cairn");
}

#[cfg(test)]
mod tests {
    use super::*;
    use cairn_contract::{Command, Query, QueryResponse};
    use tauri::Manager;

    fn test_app() -> tauri::App<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .manage(CairnState::default())
            .invoke_handler(tauri::generate_handler![send_command, run_query, ask])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("build mock app")
    }

    // Guards the Rust→webview agent-event contract: each port `AgentEvent` must
    // serialize to exactly the shape web/src/client/agent.ts expects.
    #[test]
    fn agent_event_payload_matches_webview_shape() {
        use serde_json::json;
        let cases = [
            (
                AgentEvent::TextDelta("hi".into()),
                json!({ "type": "text_delta", "text": "hi" }),
            ),
            (
                AgentEvent::ToolStarted {
                    tool: "search".into(),
                },
                json!({ "type": "tool_started", "tool": "search" }),
            ),
            (
                AgentEvent::ToolCompleted {
                    tool: "search".into(),
                    ok: true,
                },
                json!({ "type": "tool_completed", "tool": "search", "ok": true }),
            ),
            (
                AgentEvent::TurnCompleted,
                json!({ "type": "turn_completed" }),
            ),
            (AgentEvent::Completed, json!({ "type": "completed" })),
            (
                AgentEvent::Failed {
                    message: "boom".into(),
                },
                json!({ "type": "failed", "message": "boom" }),
            ),
        ];
        for (event, want) in cases {
            let payload = payload_of(event).expect("known variant maps to a payload");
            assert_eq!(serde_json::to_value(&payload).unwrap(), want);
        }
    }

    #[test]
    fn open_engine_then_write_and_query() {
        let tmp = tempfile::tempdir().unwrap();
        let mut engine = open_engine(tmp.path()).expect("open");
        let mut sink: Vec<cairn_app::Event> = Vec::new();
        cairn_service::dispatch_command(
            &mut engine,
            &Command::WriteNote {
                path: "a.md".into(),
                contents: "hello [[b]]".into(),
            },
            &mut sink,
        )
        .unwrap();
        let got = cairn_service::dispatch_query(
            &engine,
            &Query::GetNote {
                path: "a.md".into(),
            },
        )
        .unwrap();
        assert_eq!(
            got,
            QueryResponse::Note {
                contents: "hello [[b]]".into()
            }
        );
    }

    #[test]
    fn command_without_open_cairn_errors() {
        let app = test_app();
        let state = (*app.state::<CairnState>()).clone();
        let res = run_command_blocking(
            &state,
            &app.handle().clone(),
            &Command::Commit {
                message: "x".into(),
            },
        );
        assert!(matches!(res, Err(ServiceError::InvalidRequest(_))));
    }

    #[test]
    fn query_after_open_succeeds() {
        let tmp = tempfile::tempdir().unwrap();
        let app = test_app();
        let state = (*app.state::<CairnState>()).clone();
        *state.inner.lock().unwrap() =
            Some((open_engine(tmp.path()).unwrap(), tmp.path().to_path_buf()));
        run_command_blocking(
            &state,
            &app.handle().clone(),
            &Command::WriteNote {
                path: "n.md".into(),
                contents: "body".into(),
            },
        )
        .unwrap();
        let r = run_query_blocking(
            &state,
            &Query::Search {
                query: "body".into(),
            },
        )
        .unwrap();
        // `Query::Search` returns rich `SearchResults` (path + score + snippet);
        // assert on the matched path, not the volatile score/snippet fields.
        let paths: Vec<String> = match r {
            QueryResponse::SearchResults { results } => {
                results.into_iter().map(|hit| hit.path).collect()
            }
            other => panic!("expected SearchResults, got {other:?}"),
        };
        assert_eq!(paths, vec!["n.md".to_string()]);
    }

    #[test]
    fn open_at_sets_state_and_path() {
        let tmp = tempfile::tempdir().unwrap();
        let app = test_app();
        let state = (*app.state::<CairnState>()).clone();
        open_at(&state, &app.handle().clone(), tmp.path()).expect("open_at");
        assert!(state.inner.lock().unwrap().is_some());
        assert_eq!(
            state.inner.lock().unwrap().as_ref().map(|(_, p)| p.clone()),
            Some(tmp.path().to_path_buf())
        );
    }
}
