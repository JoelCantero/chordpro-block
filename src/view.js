import { initTransposeControls, refreshAllBlocks } from './transpose';

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initTransposeControls );
} else {
	initTransposeControls();
}

window.addEventListener( 'resize', refreshAllBlocks );

if ( document.fonts?.ready ) {
	document.fonts.ready.then( refreshAllBlocks ).catch( () => {} );
}
