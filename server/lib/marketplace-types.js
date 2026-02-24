/**
 * Marketplace Content Type Registry
 * Defines all content types that can be listed on the marketplace.
 */

export const MARKETPLACE_CONTENT_TYPES = Object.freeze({
  dtu_pack: { label: "Knowledge Pack", previewType: "text", icon: "book" },
  recipe: { label: "Recipe", previewType: "text", icon: "utensils" },
  workout_program: { label: "Workout Program", previewType: "text", icon: "dumbbell" },
  music_composition: { label: "Music", previewType: "audio", icon: "music" },
  artwork: { label: "Artwork", previewType: "image", icon: "palette" },
  creative_writing: { label: "Creative Writing", previewType: "text", icon: "pen" },
  course: { label: "Course", previewType: "text", icon: "graduation-cap" },
  template: { label: "Template", previewType: "text", icon: "file-text" },
  code_module: { label: "Code Module", previewType: "code", icon: "code" },
  game_world: { label: "Game World", previewType: "interactive", icon: "gamepad" },
  simulation: { label: "Simulation", previewType: "interactive", icon: "flask" },
  style_theme: { label: "Style/Theme", previewType: "visual", icon: "paintbrush" },
  workflow: { label: "Workflow", previewType: "text", icon: "git-branch" },
  lens_app: { label: "Lens App", previewType: "text", icon: "layout" },
  entity_personality: { label: "Entity Personality", previewType: "text", icon: "user" },
  whiteboard: { label: "Whiteboard", previewType: "image", icon: "square" },
  dataset: { label: "Dataset", previewType: "text", icon: "database" },
  video: { label: "Video", previewType: "video", icon: "film" },
  document: { label: "Document", previewType: "text", icon: "file" },
  binary_artifact: { label: "Binary File", previewType: "download", icon: "package" },
});

export function getContentTypeInfo(type) {
  return MARKETPLACE_CONTENT_TYPES[type] || { label: type, previewType: "text", icon: "file" };
}

export function listContentTypes() {
  return Object.entries(MARKETPLACE_CONTENT_TYPES).map(([id, info]) => ({ id, ...info }));
}
