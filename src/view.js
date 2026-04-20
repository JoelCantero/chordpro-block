import { initTransposeControls, refreshAllBlocks } from './transpose';

function debounce( callback, delay ) {
	let timeoutId;

	return () => {
		window.clearTimeout( timeoutId );
		timeoutId = window.setTimeout( callback, delay );
	};
}

function initView() {
	initTransposeControls();

	if ( typeof window.ResizeObserver === 'undefined' ) {
		window.addEventListener( 'resize', debounce( refreshAllBlocks, 120 ) );
	}

	if ( document.fonts?.ready ) {
		document.fonts.ready.then( refreshAllBlocks ).catch( () => {} );
	}
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initView );
} else {
	initView();
}
