// The Designer's document model: the open screen file and every edit to it as an operation. Public interface.
export { EditError, type Doc, type ScreenFile, type Screen, type Element } from './core.ts';
export { newDocument, apply } from './document.ts';
export type { Op } from './operations.ts';
export { themeOf, newScreenName, titleOf, firstScreenOf } from './ops/screens.ts';
export { newElementName } from './ops/elements.ts';
export { imagePathFor, isImagePath, usedImages, missingImages, type ImageUse } from './ops/images.ts';
export { createHistory, dispatch, undo, redo, canUndo, canRedo, type History } from './history.ts';
export { importZip, importScreenFile, exportZip, screenFileProblem, ImportError } from './zip.ts';
export { languagesOf, textIn, hasText, isTextMap, textsOf, missingTranslations, type TextPlace, type TextMap } from './texts.ts';
export { autosave, memoryStore, type Autosave, type DesignStore, type StoredDesign } from './autosave.ts';
