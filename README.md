# Decklist Maker

Live demo: https://matpag.github.io/YuGiOhDecklistGenerator/

Decklist Maker is a browser-based editor for creating Yu-Gi-Oh decklist graphics from reusable templates. It runs locally in your browser, lets you design a template with text layers and image slots, fill batch rows with decklist data, and export one PNG per row.

Use the toolbar at the top to open templates, save templates, save copies, preview the selected row, export the selected row, export all rows, and switch theme.

## Top Toolbar

### Open Template

Use the folder button to load a saved `.dhdecktemplate` file. The template restores the canvas size, background image, text layers, image slots, uploaded slot images, and embedded fonts.

In Chrome and Edge, the app remembers the opened local file so Save can write back to it directly.

### Save Template

Use the floppy disk button to save the current template.

In Chrome and Edge, if the template was opened through the app's file picker, Save overwrites the same local `.dhdecktemplate` file. If no direct file handle is available, Save behaves like Save As.

### Save Template As

Use the Save As button to choose a new destination or filename for the current template.

In browsers that do not support direct file writing, Save As downloads a new `.dhdecktemplate` copy.

### Opened Template Status

After opening or saving a template through the file picker, the top bar shows the active template filename.

The status also shows whether direct save is enabled. Browsers do not expose the full local filesystem path, so the app can show the filename but not the complete `C:\...` path.

### Preview Selected Row

Use the eye button to open a dialog showing the exact PNG render for the currently selected batch row. Editor-only outlines, handles, and selection overlays are hidden in the preview.

The preview dialog includes:

- Download button: downloads the previewed PNG.
- Close button: closes the dialog.
- Backdrop click: closes the dialog.

### Export Current

Use the Current export button to export only the selected batch row as a PNG.

Before exporting, the app checks that every dynamic text and image slot for that row has been filled in the batch table. If anything is missing, export is blocked and the missing row/layer IDs are listed.

### Export All

Use the All export button to export every batch row as individual PNG downloads.

Before exporting, the app checks every dynamic text and image slot in every batch row. If anything is missing, export is blocked and the missing row/layer IDs are listed.

Exported filenames are prefixed with the batch row number, such as `01-player-name.png`, `02-player-name.png`, and so on.

### Theme

Use the Light/Dark button to switch the editor theme. This only affects the editor interface, not the exported image.

## Preview Area

The center panel shows the editable canvas.

### Zoom Controls

Use the zoom toolbar to change how the canvas is displayed while editing:

- `Fill`: fits the canvas into the available preview area while preserving aspect ratio.
- Preset percentages: switch to a fixed zoom level.
- Custom zoom input: type a custom zoom percentage.

Zoom only changes the editor view. It does not change the exported PNG dimensions.

### Selecting Layers

Click a text layer or image slot on the canvas to select it. The selected layer shows editor-only handles and outlines.

Selection handles are hidden from preview and PNG export.

### Moving Layers

Select a layer and drag it on the canvas to move it.

You can also edit the selected layer's X and Y values in the left editor panel.

### Resizing Layers

Select a text layer or image slot and drag its handles to resize it.

You can also edit the selected layer's Width and Height values in the left editor panel.

## Left Editor Panel

The left panel controls the canvas, template assets, layer creation, and selected layer properties. Use the collapse button at the top-left of the panel to hide or show this panel.

### Canvas

Set the output canvas width and height. These values define the final PNG dimensions.

The default canvas size is `1080 x 1080`.

### Template

Use this section to upload assets shared by the template.

Template controls:

- Background: uploads the canvas background image. The background fills the full canvas.
- Font file: uploads a `.ttf`, `.otf`, `.woff`, or `.woff2` font file.

When uploading a font, the app asks for a font alias. The alias defaults to the original filename. Embedded fonts are saved inside the `.dhdecktemplate` file and become available in text layer font controls.

### Add Layer

Use this section to create template layers.

Layer buttons:

- Text: creates a new editable text layer.
- Image slot: creates a new editable image placeholder rectangle.

Every layer has a unique Layer ID. Layer IDs are used by the batch table to decide which data replaces which template layer.

### Selected Layer

This section appears when a layer is selected.

Common controls:

- Layer ID: unique ID used by the batch table.
- Use this layer in batch rows: marks the layer as dynamic.
- X: horizontal position.
- Y: vertical position.
- Width: layer width.
- Height: layer height.
- Rotation: layer rotation.

If `Use this layer in batch rows` is enabled, the layer must be filled in each relevant batch row before export.

### Text Layer Controls

Text layer controls:

- Default text: text shown when no batch value is being previewed.
- Font: selects a system or embedded font.
- Style: normal, bold, italic, or bold italic.
- Font size: text size.
- Line height: spacing between text lines.
- Fill: text fill color.
- Stroke: text outline color.
- Stroke width: outline thickness.
- Align: horizontal text alignment.
- Vertical: vertical text alignment inside the text box.
- Auto-shrink dynamic text: reduces text size during export if dynamic text is too long for the box.
- Shadow: enables text shadow controls.

Static text layers are edited in the template only. Dynamic text layers are replaced by batch row values during preview and export.

### Image Slot Controls

Image slot controls:

- Fit: controls how images fit inside the slot.
- Upload slot image: uploads a default image for that image slot.

Fit modes:

- Contain: shows the full image inside the slot while preserving aspect ratio.
- Cover: fills the slot while preserving aspect ratio, cropping if needed.
- Stretch: stretches the image to exactly match the slot.

Uploaded slot images are embedded in the template file. If the image slot is dynamic and a batch row image is provided, the batch row image replaces the uploaded slot image during preview and export.

When an uploaded slot image exists and `Use this layer in batch rows` is enabled, the app shows a warning that the image will be replaced at export time by the batch row image.

## Right Panel

The right panel contains the layer stack and batch table. Use the collapse button at the top of the panel to hide or show this panel.

### Layers Tab

Use the Layers tab to manage the layer stack.

Layer stack controls:

- Layer row: selects a layer.
- Move up: moves the layer higher in the stack.
- Move down: moves the layer lower in the stack.
- Delete: removes the layer.

Higher layers render above lower layers.

### Batch Tab

Use the Batch tab to enter the dynamic values used for PNG export.

The table columns are generated from dynamic layer IDs:

- Dynamic text layers become text input columns.
- Dynamic image slots become image upload columns.

Each row represents one exported PNG.

Batch row controls:

- Row: selects the row for preview/current export.
- Text cells: set dynamic text values for that row.
- Image cells: upload the image used for that dynamic image slot in that row.
- Duplicate row: copies a row.
- Delete row: removes a row when more than one row exists.
- Row button: adds a new empty batch row.

## Dynamic Content Rules

Dynamic content is controlled by the `Use this layer in batch rows` checkbox.

For export:

- Every dynamic text layer must have a non-empty value in every exported row.
- Every dynamic image slot must have an uploaded image in every exported row.
- Static layers do not require batch values.

If required dynamic content is missing, export is blocked and the app lists the missing row numbers and layer IDs.

## Template Files

Templates are saved as `.dhdecktemplate` files. A template file contains:

- Canvas settings
- Background image
- Text layer settings
- Image slot settings
- Uploaded slot images
- Embedded fonts
- Uploaded template asset files

Batch row images are session data and are not saved inside the template file.

Use template files when you want to keep editing later or reuse the same decklist graphic layout for another event.

## Export Notes

Preview, Export Current, and Export All use the same render path. All editor-only overlays are hidden before rendering.

The exported PNG uses the canvas dimensions configured in the Canvas section, regardless of editor zoom.

If the browser asks for permission to download multiple files, allow it when using Export All.
