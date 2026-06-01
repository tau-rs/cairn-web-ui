use std::path::{Path, PathBuf};
use std::sync::Mutex;

use cairn_app::{Engine, Event as AppEvent, EventSink};
use cairn_contract::{Command, CommandResponse, ContractError, Query, QueryResponse};
use cairn_infra::{GitVcs, InMemoryIndex, LocalFsStore};
use cairn_service::{app_event_to_wire, dispatch_command, dispatch_query, ServiceError};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

/// The concrete engine the desktop app runs.
type CairnEngine = Engine<LocalFsStore, InMemoryIndex, GitVcs>;

/// Shared app state: the engine (None until a cairn is opened) + its path.
#[derive(Default)]
struct CairnState {
    engine: Mutex<Option<CairnEngine>>,
    path: Mutex<Option<PathBuf>>,
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
    let store = LocalFsStore::open(dir).map_err(|e| ServiceError::Internal(e.to_string()))?;
    let vcs = GitVcs::open_or_init(dir).map_err(|e| ServiceError::Internal(e.to_string()))?;
    Ok(Engine::new(store, InMemoryIndex::default(), vcs))
}

fn run_command_blocking<R: Runtime>(
    state: &State<CairnState>,
    app: &AppHandle<R>,
    command: &Command,
) -> Result<CommandResponse, ServiceError> {
    let mut guard = state.engine.lock().expect("engine mutex poisoned");
    let engine = guard
        .as_mut()
        .ok_or_else(|| ServiceError::InvalidRequest("no cairn open".into()))?;
    let mut sink = TauriSink(app.clone());
    dispatch_command(engine, command, &mut sink)
}

fn run_query_blocking(
    state: &State<CairnState>,
    query: &Query,
) -> Result<QueryResponse, ServiceError> {
    let guard = state.engine.lock().expect("engine mutex poisoned");
    let engine = guard
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
    run_command_blocking(&state, &app, &command).map_err(ContractError::from)
}

#[tauri::command]
async fn run_query(
    state: State<'_, CairnState>,
    query: Query,
) -> Result<QueryResponse, ContractError> {
    run_query_blocking(&state, &query).map_err(ContractError::from)
}

/// Open a cairn at `dir`: build the engine, reindex (emitting events), record
/// it in state, and persist the path for next launch.
fn open_at<R: Runtime>(
    state: &State<CairnState>,
    app: &AppHandle<R>,
    dir: &Path,
) -> Result<(), ServiceError> {
    let mut engine = open_engine(dir)?;
    let mut sink = TauriSink(app.clone());
    engine.reindex(&mut sink).map_err(|e| ServiceError::Internal(e.to_string()))?;
    *state.engine.lock().expect("poisoned") = Some(engine);
    *state.path.lock().expect("poisoned") = Some(dir.to_path_buf());
    let _ = persist_path(app, dir); // persistence failure is non-fatal
    Ok(())
}

fn config_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("last-cairn.txt"))
}

fn persist_path<R: Runtime>(app: &AppHandle<R>, dir: &Path) -> std::io::Result<()> {
    if let Some(f) = config_file(app) {
        if let Some(parent) = f.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(f, dir.to_string_lossy().as_bytes())?;
    }
    Ok(())
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
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(folder) = picked else { return Ok(None) };
    let dir = folder
        .into_path()
        .map_err(|e| ContractError::Internal { message: e.to_string() })?;
    open_at(&state, &app, &dir).map_err(ContractError::from)?;
    Ok(Some(dir.to_string_lossy().into_owned()))
}

#[tauri::command]
fn current_cairn(state: State<'_, CairnState>) -> Option<String> {
    state.path.lock().expect("poisoned").as_ref().map(|p| p.to_string_lossy().into_owned())
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
            &Command::WriteNote { path: "a.md".into(), contents: "hello [[b]]".into() },
            &mut sink,
        )
        .unwrap();
        let got = cairn_service::dispatch_query(&engine, &Query::GetNote { path: "a.md".into() }).unwrap();
        assert_eq!(got, QueryResponse::Note { contents: "hello [[b]]".into() });
    }

    #[test]
    fn command_without_open_cairn_errors() {
        let app = test_app();
        let state: tauri::State<CairnState> = app.state();
        let res = run_command_blocking(&state, &app.handle().clone(),
            &Command::Commit { message: "x".into() });
        assert!(matches!(res, Err(ServiceError::InvalidRequest(_))));
    }

    #[test]
    fn query_after_open_succeeds() {
        let tmp = tempfile::tempdir().unwrap();
        let app = test_app();
        let state: tauri::State<CairnState> = app.state();
        *state.engine.lock().unwrap() = Some(open_engine(tmp.path()).unwrap());
        run_command_blocking(&state, &app.handle().clone(),
            &Command::WriteNote { path: "n.md".into(), contents: "body".into() }).unwrap();
        let r = run_query_blocking(&state, &Query::Search { query: "body".into() }).unwrap();
        assert_eq!(r, QueryResponse::Paths { paths: vec!["n.md".into()] });
    }

    #[test]
    fn open_at_sets_state_and_path() {
        let tmp = tempfile::tempdir().unwrap();
        let app = test_app();
        let state: tauri::State<CairnState> = app.state();
        open_at(&state, &app.handle().clone(), tmp.path()).expect("open_at");
        assert!(state.engine.lock().unwrap().is_some());
        assert_eq!(state.path.lock().unwrap().as_deref(), Some(tmp.path()));
    }
}
