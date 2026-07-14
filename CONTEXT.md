# LiteMark

LiteMark edits local Markdown and text documents. The domain centers on keeping an editing session consistent with the user's files on disk.

## Language

**Document**:
A local Markdown or text file that LiteMark can open and edit.
_Avoid_: Note, item

**Document Session**:
The currently edited Document together with its content, persisted snapshot, path, and save state.
_Avoid_: File manager, editor state

**Dirty Document**:
A Document Session whose current content differs from its last persisted snapshot.
_Avoid_: Modified file, changed note

**Recent Document**:
A persisted reference to a previously opened Document. It is navigation history, not ownership of the file on disk.
_Avoid_: Recent file item

**Available Document**:
A transient reference discovered by scanning a directory. It may be opened, but it is not added to Recent Documents until then.
_Avoid_: Recent Document, directory file

**Work Directory**:
The user-selected directory in which LiteMark creates new Documents by default.
_Avoid_: Workspace, project folder
