import { registerBlockType } from '@wordpress/blocks';
import './style.scss'; // extracted by @wordpress/scripts splitChunks → build/style-index.css
import './editor.scss'; // editor-only → build/index.css
import Edit from './edit';
import save from './save';
import metadata from './block.json';

registerBlockType( metadata.name, {
	edit: Edit,
	save,
} );
