use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::oneshot;

#[derive(Clone, Copy)]
pub(crate) struct PermissionDecision {
    pub(crate) allow: bool,
}

type PermissionSender = oneshot::Sender<PermissionDecision>;
type PermissionRegistry = Arc<Mutex<HashMap<u64, PermissionSender>>>;

static PERMISSION_REQUESTS: OnceLock<PermissionRegistry> = OnceLock::new();

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn permission_registry() -> PermissionRegistry {
    PERMISSION_REQUESTS
        .get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
        .clone()
}

pub(crate) fn register_permission_request() -> (u64, oneshot::Receiver<PermissionDecision>) {
    let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::SeqCst);
    let (sender, receiver) = oneshot::channel();
    permission_registry()
        .lock()
        .expect("permission registry poisoned")
        .insert(id, sender);
    (id, receiver)
}

pub(crate) fn discard_permission_request(request_id: u64) {
    if let Ok(mut registry) = permission_registry().lock() {
        registry.remove(&request_id);
    }
}

pub(crate) fn resolve_permission(request_id: u64, allow: bool) -> Result<(), String> {
    let sender = permission_registry()
        .lock()
        .map_err(|_| "permission registry poisoned".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "permission request not found.".to_string())?;
    sender
        .send(PermissionDecision { allow })
        .map_err(|_| "permission request already resolved.".to_string())
}
