use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

pub(crate) type CancellationRegistry = Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>;
static CANCELLATION_REQUESTS: OnceLock<CancellationRegistry> = OnceLock::new();
type WorkspaceLockRegistry = Arc<Mutex<HashMap<PathBuf, String>>>;
static WORKSPACE_WRITE_LOCKS: OnceLock<WorkspaceLockRegistry> = OnceLock::new();

pub(crate) fn cancellation_registry() -> CancellationRegistry {
    CANCELLATION_REQUESTS
        .get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
        .clone()
}

pub(crate) fn cancel_run(run_id: &str) -> Result<(), String> {
    let flag = cancellation_registry()
        .lock()
        .map_err(|_| "cancellation registry poisoned".to_string())?
        .get(run_id)
        .cloned()
        .ok_or_else(|| "agent run not found".to_string())?;
    flag.store(true, Ordering::SeqCst);
    Ok(())
}

pub(crate) struct RunRegistration {
    run_id: String,
    flag: Arc<AtomicBool>,
}

impl RunRegistration {
    pub(crate) fn register(run_id: String) -> Result<Self, String> {
        let flag = Arc::new(AtomicBool::new(false));
        let registry = cancellation_registry();
        let mut registry = registry
            .lock()
            .map_err(|_| "cancellation registry poisoned".to_string())?;
        if registry.contains_key(&run_id) {
            return Err("an agent run with this id is already active".to_string());
        }
        registry.insert(run_id.clone(), flag.clone());
        Ok(Self { run_id, flag })
    }

    pub(crate) fn cancelled(&self) -> bool {
        self.flag.load(Ordering::SeqCst)
    }
}

impl Drop for RunRegistration {
    fn drop(&mut self) {
        if let Ok(mut registry) = cancellation_registry().lock() {
            registry.remove(&self.run_id);
        }
    }
}

fn workspace_lock_registry() -> WorkspaceLockRegistry {
    WORKSPACE_WRITE_LOCKS
        .get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
        .clone()
}

pub(crate) struct WorkspaceWriteGuard {
    path: PathBuf,
    run_id: String,
}

impl WorkspaceWriteGuard {
    pub(crate) fn acquire(work_dir: &Path, run_id: &str) -> Result<Self, String> {
        let path = work_dir
            .canonicalize()
            .map_err(|error| format!("cannot resolve the working directory: {error}"))?;
        let registry = workspace_lock_registry();
        let mut registry = registry
            .lock()
            .map_err(|_| "workspace lock registry poisoned".to_string())?;
        if let Some(owner) = registry.get(&path) {
            if owner != run_id {
                return Err("another agent run is already writing to this workspace".to_string());
            }
        }
        registry.insert(path.clone(), run_id.to_string());
        Ok(Self {
            path,
            run_id: run_id.to_string(),
        })
    }
}

impl Drop for WorkspaceWriteGuard {
    fn drop(&mut self) {
        if let Ok(mut registry) = workspace_lock_registry().lock() {
            if registry.get(&self.path) == Some(&self.run_id) {
                registry.remove(&self.path);
            }
        }
    }
}
