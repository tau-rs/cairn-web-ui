mod plugin_protocol;
mod plugin_roots;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use cairn_app::{Engine, Event as AppEvent, EventSink};
use cairn_contract::{
    AnswerEvent, AskRequest, Command, CommandResponse, ContractError, Query, QueryResponse,
};
use cairn_infra::{GitVcs, LocalFsStore, NullRuntime, TantivyIndex, TauConfig, TauServeRuntime};
use cairn_ports::{AgentEvent, AgentRuntime, AgentSink};
use cairn_service::{
    agent_event_to_wire, app_event_to_wire, dispatch_command, dispatch_query,
    gather_answer_context, ServiceError,
};
use tauri::http::Response;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use plugin_roots::{set_plugin_ui_roots, PluginRoots};

/// The concrete engine the desktop app runs. `Engine` boxes its adapters, so the
/// type alias is just a readable name for the one engine this shell builds.
type CairnEngine = Engine;

/// Shared app state: the engine + its path behind a single mutex (None until a
/// cairn is opened), plus the agent runtime backing `ask`. `Clone` lets us move
/// the `Arc`s into `spawn_blocking`.
#[derive(Clone)]
struct CairnState {
    inner: Arc<Mutex<Option<(CairnEngine, PathBuf)>>>,
    /// Agent runtime for `ask`. Built from the environment at startup:
    /// `TauServeRuntime` when `TAU_BIN` is set, else `NullRuntime` (which errors
    /// at answer time, surfaced as a single `Failed` frame).
    runtime: Arc<dyn AgentRuntime + Send + Sync>,
}

/// Build the agent runtime from the process environment. `TAU_BIN` (+ optional
/// `TAU_AGENT`/`TAU_PROJECT`) selects the real `tau serve` runtime; absent, the
/// `NullRuntime` placeholder errors at answer time.
fn runtime_from_env() -> Arc<dyn AgentRuntime + Send + Sync> {
    match TauConfig::from_env() {
        Some(cfg) => Arc::new(TauServeRuntime::new(cfg)),
        None => Arc::new(NullRuntime),
    }
}

impl Default for CairnState {
    fn default() -> Self {
        Self {
            inner: Arc::default(),
            runtime: runtime_from_env(),
        }
    }
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
    let store =
        LocalFsStore::open(dir).map_err(|e| ServiceError::Internal(e.to_string().into()))?;
    let vcs =
        GitVcs::open_or_init(dir).map_err(|e| ServiceError::Internal(e.to_string().into()))?;
    let index =
        TantivyIndex::in_memory().map_err(|e| ServiceError::Internal(e.to_string().into()))?;
    Ok(Engine::new(store, index, vcs))
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

/// Stream a note-grounded answer into `emit`: gather retrieval context under the
/// engine lock, emit the leading `Sources` frame, then run the agent lock-free
/// and forward each increment as a wire `AnswerEvent`. Mirrors the daemon's
/// `ask_handler`. A gather failure (no cairn open, search error) returns `Err`
/// before any frame; an agent failure is delivered as a terminal `Failed` frame.
fn stream_answer(
    state: &CairnState,
    req: &AskRequest,
    emit: &mut dyn FnMut(AnswerEvent),
) -> Result<(), ServiceError> {
    let top_k = req.top_k.unwrap_or(5);
    // Gather retrieval context under the engine lock, then drop the guard before
    // the (seconds-long) agent run so it never blocks commands/queries.
    let (prompt, cited) = {
        let guard = state.inner.lock().expect("engine mutex poisoned");
        let (engine, _path) = guard
            .as_ref()
            .ok_or_else(|| ServiceError::InvalidRequest("no cairn open".into()))?;
        gather_answer_context(engine, &req.query, top_k)?
    };
    emit(AnswerEvent::Sources { paths: cited });

    // Adapt the agent's `AgentEvent` stream into wire `AnswerEvent` frames.
    struct WireSink<'a> {
        emit: &'a mut dyn FnMut(AnswerEvent),
    }
    impl AgentSink for WireSink<'_> {
        fn emit(&mut self, event: AgentEvent) {
            if let Some(wire) = agent_event_to_wire(event) {
                (self.emit)(wire);
            }
        }
    }
    let mut sink = WireSink { emit };
    // A run that starts then fails reports via `AgentEvent::Failed` on the sink;
    // an `Err` means it failed before any event (e.g. tau not configured) —
    // route it through the same mapping so the UI sees one terminal `Failed`.
    if let Err(e) = state.runtime.answer(&prompt, &mut sink) {
        sink.emit(AgentEvent::Failed {
            message: e.to_string(),
        });
    }
    Ok(())
}

#[tauri::command]
async fn ask(
    state: State<'_, CairnState>,
    request: AskRequest,
    channel: tauri::ipc::Channel<AnswerEvent>,
) -> Result<(), ContractError> {
    let state = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut emit = |e: AnswerEvent| {
            // A closed channel (webview dropped the stream) turns sends into
            // no-ops; the run still finishes (no v1 cancellation), matching the
            // daemon's fire-and-forget producer.
            let _ = channel.send(e);
        };
        stream_answer(&state, &request, &mut emit).map_err(ContractError::from)
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

/// Open a cairn at `dir`: build the engine, reindex (emitting events), record
/// engine+path atomically in state, and persist the path for next launch.
fn open_at<R: Runtime>(
    state: &CairnState,
    app: &AppHandle<R>,
    dir: &Path,
) -> Result<(), ServiceError> {
    let mut engine = open_engine(dir)?;
    let mut sink = TauriSink(app.clone());
    engine
        .reindex(&mut sink)
        .map_err(|e| ServiceError::Internal(e.to_string().into()))?;
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
        .manage(PluginRoots::default())
        // Tier-3 6b: serve each plugin's on-disk ui/ bundle at a distinct
        // opaque origin (plugin-sandbox://<id>/...). The handler is a thin
        // adapter over the unit-tested `plugin_protocol` core: id→root lookup
        // against the registered allow-list, strict path-canonicalisation, MIME,
        // and a locked-down per-frame CSP on every response.
        .register_uri_scheme_protocol("plugin-sandbox", |ctx, request| {
            let id = request.uri().host().unwrap_or("").to_string();
            let rel = request.uri().path().trim_start_matches('/').to_string();
            let roots = ctx.app_handle().state::<PluginRoots>();
            let (status, mime, body) = plugin_protocol::build_response(&roots, &id, &rel);
            Response::builder()
                .status(status)
                .header("Content-Type", mime)
                .header("Content-Security-Policy", plugin_protocol::plugin_csp())
                .header("X-Content-Type-Options", "nosniff")
                .body(body)
                .unwrap()
        })
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
            current_cairn,
            set_plugin_ui_roots
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
            .invoke_handler(tauri::generate_handler![send_command, run_query])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("build mock app")
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
        // The Tantivy-backed engine answers Search with rich SearchResults
        // (path + score + snippet), not bare Paths.
        match r {
            QueryResponse::SearchResults { results } => assert_eq!(
                results.iter().map(|x| x.path.as_str()).collect::<Vec<_>>(),
                vec!["n.md"]
            ),
            other => panic!("expected SearchResults, got {other:?}"),
        }
    }

    /// An `AgentRuntime` that emits a scripted sequence of `AgentEvent`s then
    /// succeeds — stands in for a real `tau serve` run.
    struct ScriptedRuntime(Vec<AgentEvent>);
    impl AgentRuntime for ScriptedRuntime {
        fn answer(
            &self,
            _prompt: &str,
            sink: &mut dyn AgentSink,
        ) -> Result<(), cairn_ports::PortError> {
            for e in &self.0 {
                sink.emit(e.clone());
            }
            Ok(())
        }
    }

    fn open_state(dir: &Path, runtime: Arc<dyn AgentRuntime + Send + Sync>) -> CairnState {
        let engine = open_engine(dir).unwrap();
        CairnState {
            inner: Arc::new(Mutex::new(Some((engine, dir.to_path_buf())))),
            runtime,
        }
    }

    #[test]
    fn ask_streams_sources_then_mapped_answer_events() {
        let tmp = tempfile::tempdir().unwrap();
        let state = open_state(
            tmp.path(),
            Arc::new(ScriptedRuntime(vec![
                AgentEvent::TextDelta("Hel".into()),
                AgentEvent::TextDelta("lo".into()),
                AgentEvent::Completed,
            ])),
        );
        let mut got: Vec<AnswerEvent> = Vec::new();
        stream_answer(
            &state,
            &AskRequest {
                query: "anything".into(),
                top_k: None,
            },
            &mut |e| got.push(e),
        )
        .unwrap();
        // First frame is always Sources (possibly empty), then the agent run.
        assert!(matches!(got.first(), Some(AnswerEvent::Sources { .. })));
        assert_eq!(
            &got[1..],
            &[
                AnswerEvent::TextDelta { text: "Hel".into() },
                AnswerEvent::TextDelta { text: "lo".into() },
                AnswerEvent::Completed,
            ]
        );
    }

    #[test]
    fn ask_without_open_cairn_errs_before_any_frame() {
        let state = CairnState {
            inner: Arc::new(Mutex::new(None)),
            runtime: Arc::new(ScriptedRuntime(vec![])),
        };
        let mut got: Vec<AnswerEvent> = Vec::new();
        let r = stream_answer(
            &state,
            &AskRequest {
                query: "x".into(),
                top_k: None,
            },
            &mut |e| got.push(e),
        );
        assert!(matches!(r, Err(ServiceError::InvalidRequest(_))));
        assert!(got.is_empty());
    }

    #[test]
    fn ask_emits_terminal_failed_when_runtime_errors() {
        let tmp = tempfile::tempdir().unwrap();
        // NullRuntime errors before any event (tau not configured).
        let state = open_state(tmp.path(), Arc::new(NullRuntime));
        let mut got: Vec<AnswerEvent> = Vec::new();
        stream_answer(
            &state,
            &AskRequest {
                query: "x".into(),
                top_k: None,
            },
            &mut |e| got.push(e),
        )
        .unwrap();
        assert!(matches!(got.first(), Some(AnswerEvent::Sources { .. })));
        assert!(matches!(got.last(), Some(AnswerEvent::Failed { .. })));
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
