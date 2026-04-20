import { __, sprintf } from '@wordpress/i18n';
import { getTransposeContext, transposeChord } from './chordpro-transpose';

let measureCanvas;
let refreshFrame = null;
const queuedBlocks = new Set();
const measurementCache = new Map();
const anchorMetricsCache = new WeakMap();
const blockObservers = new WeakMap();

function getMeasureContext() {
	if ( ! measureCanvas ) {
		measureCanvas = document.createElement( 'canvas' );
	}

	return measureCanvas.getContext( '2d' );
}

function getNodeFont( node ) {
	const style = window.getComputedStyle( node );

	return (
		style.font ||
		`${ style.fontStyle } ${ style.fontVariant } ${ style.fontWeight } ${ style.fontSize } / ${ style.lineHeight } ${ style.fontFamily }`
	);
}

function getMeasurementCacheKey( text, font ) {
	return `${ font }::${ text }`;
}

function measureTextWidth( text, font ) {
	const context = getMeasureContext();

	if ( ! context ) {
		return 0;
	}

	const cacheKey = getMeasurementCacheKey( text, font );

	if ( measurementCache.has( cacheKey ) ) {
		return measurementCache.get( cacheKey );
	}

	context.font = font;

	const width = context.measureText( text ).width;

	measurementCache.set( cacheKey, width );

	return width;
}

function getCodeUnitOffsets( text ) {
	const offsets = [ 0 ];
	let total = 0;

	for ( const char of text ) {
		total += char.length;
		offsets.push( total );
	}

	return offsets;
}

function getAnchorCacheEntry( lyricNode, signature ) {
	const currentCache = anchorMetricsCache.get( lyricNode );

	if ( currentCache?.signature === signature ) {
		return currentCache.positions;
	}

	const positions = new Map();

	anchorMetricsCache.set( lyricNode, {
		signature,
		positions,
	} );

	return positions;
}

function getAnchorMetrics(
	lyricNode,
	lyricChars,
	codeUnitOffsets,
	position,
	signature
) {
	const safePosition = Math.max( 0, Math.min( position, lyricChars.length ) );
	const positions = getAnchorCacheEntry( lyricNode, signature );

	if ( positions.has( safePosition ) ) {
		return positions.get( safePosition );
	}

	const textNode = lyricNode.firstChild;

	if ( ! textNode || textNode.nodeType !== 3 ) {
		return null;
	}

	if ( lyricChars.length === 0 ) {
		const emptyMetrics = {
			left: 0,
			top: 0,
		};

		positions.set( safePosition, emptyMetrics );

		return emptyMetrics;
	}

	const lyricRect = lyricNode.getBoundingClientRect();
	const range = document.createRange();
	let metrics = null;

	range.setStart( textNode, codeUnitOffsets[ safePosition ] );
	range.collapse( true );

	const caretRect = Array.from( range.getClientRects() ).find(
		( currentRect ) => currentRect.width >= 0 || currentRect.height > 0
	);

	if ( caretRect ) {
		metrics = {
			left: caretRect.left - lyricRect.left,
			top: caretRect.top - lyricRect.top,
		};
	}

	if ( ! metrics && safePosition < lyricChars.length ) {
		range.setStart( textNode, codeUnitOffsets[ safePosition ] );
		range.setEnd( textNode, codeUnitOffsets[ safePosition + 1 ] );

		const rect = Array.from( range.getClientRects() ).find(
			( currentRect ) => currentRect.width > 0 || currentRect.height > 0
		);

		if ( rect ) {
			metrics = {
				left: rect.left - lyricRect.left,
				top: rect.top - lyricRect.top,
			};
		}
	}

	if ( ! metrics && safePosition > 0 ) {
		range.setStart( textNode, codeUnitOffsets[ safePosition - 1 ] );
		range.setEnd( textNode, codeUnitOffsets[ safePosition ] );

		const rects = Array.from( range.getClientRects() ).filter(
			( currentRect ) => currentRect.width > 0 || currentRect.height > 0
		);
		const rect = rects[ rects.length - 1 ];

		if ( rect ) {
			metrics = {
				left: rect.right - lyricRect.left,
				top: rect.top - lyricRect.top,
			};
		}
	}

	if ( metrics ) {
		positions.set( safePosition, metrics );
	}

	return metrics;
}

function getBlockTransposeSettings( block, offset ) {
	const keyNode = block.querySelector( '[data-original-key]' );

	if ( ! keyNode ) {
		return {
			displayKey: null,
			preferFlats: null,
		};
	}

	const keyContext = getTransposeContext(
		keyNode.dataset.originalKey,
		offset
	);

	return {
		displayKey: keyContext?.displayKey ?? keyNode.dataset.originalKey,
		preferFlats: keyContext?.preferFlats ?? null,
	};
}

function recalculateLinePositions( line, offset, transposeSettings ) {
	const chords = Array.from(
		line.querySelectorAll( '.chordpro-chord[data-original-chord]' )
	);
	const chordsContainer = line.querySelector( '.chordpro-chords' );
	const lyricNode = line.querySelector( '.chordpro-lyric' );

	if ( chords.length === 0 || ! lyricNode || ! chordsContainer ) {
		return;
	}

	const lyricText = lyricNode.textContent || '';
	const lyricChars = Array.from( lyricText );
	const codeUnitOffsets = getCodeUnitOffsets( lyricText );
	const lyricFont = getNodeFont( lyricNode );
	const chordFont = getNodeFont( chords[ 0 ] );
	const chordGap = measureTextWidth( ' ', chordFont );
	const lyricLineHeight = parseFloat(
		window.getComputedStyle( lyricNode ).lineHeight
	);
	const mobileLayout = window.matchMedia( '(max-width: 600px)' ).matches;
	const lyricHeight = lyricNode.getBoundingClientRect().height;
	const wrappedLyric =
		mobileLayout &&
		Number.isFinite( lyricLineHeight ) &&
		lyricHeight > lyricLineHeight * 1.5;
	const positionedChords = [];
	const anchorSignature = [
		lyricText,
		lyricNode.clientWidth,
		lyricFont,
		lyricLineHeight,
		mobileLayout ? 'mobile' : 'desktop',
	].join( '|' );
	let previousBaseLyricPosition = null;
	let chordOffset = 0;

	chords.forEach( ( chord ) => {
		const originalChord = chord.dataset.originalChord;
		const baseLyricPosition = parseInt(
			chord.dataset.lyricPosition || '0',
			10
		);
		const segmentLength = parseInt(
			chord.dataset.lyricSegmentLength || '0',
			10
		);
		const transposed = transposeChord( originalChord, offset, {
			preferFlats: transposeSettings.preferFlats,
		} );

		if ( previousBaseLyricPosition !== baseLyricPosition ) {
			chordOffset = 0;
		}

		const anchorMetrics = getAnchorMetrics(
			lyricNode,
			lyricChars,
			codeUnitOffsets,
			baseLyricPosition,
			anchorSignature
		);
		const lyricPrefix = lyricChars.slice( 0, baseLyricPosition ).join( '' );
		const fallbackLeft = measureTextWidth( lyricPrefix, lyricFont );
		const anchorLeft = anchorMetrics?.left ?? fallbackLeft;
		const visualRow =
			mobileLayout && Number.isFinite( lyricLineHeight )
				? Math.max(
						0,
						Math.round(
							( anchorMetrics?.top ?? 0 ) / lyricLineHeight
						)
				  )
				: 0;
		let anchorTop = 0;

		if (
			mobileLayout &&
			Number.isFinite( lyricLineHeight ) &&
			wrappedLyric
		) {
			anchorTop = visualRow * lyricLineHeight + 3;
		}

		const rowKey = wrappedLyric ? visualRow : 0;

		chord.style.left = `${ anchorLeft + chordOffset }px`;
		chord.style.top = `${ anchorTop }px`;
		positionedChords.push( { chord, rowKey } );

		if ( segmentLength > 0 ) {
			chordOffset = 0;
		} else {
			chordOffset += measureTextWidth( transposed, chordFont ) + chordGap;
		}

		previousBaseLyricPosition = baseLyricPosition + segmentLength;

		if ( segmentLength === 0 ) {
			previousBaseLyricPosition = baseLyricPosition;
		}
	} );

	const containerRect = chordsContainer.getBoundingClientRect();
	const previousRightByRow = new Map();

	positionedChords.forEach( ( { chord, rowKey } ) => {
		const previousRight = previousRightByRow.get( rowKey );
		const chordRect = chord.getBoundingClientRect();
		const chordLeft = chordRect.left - containerRect.left;

		if (
			typeof previousRight === 'number' &&
			chordLeft < previousRight + chordGap
		) {
			const currentLeft = parseFloat( chord.style.left || '0' );
			const nextLeft =
				currentLeft + ( previousRight + chordGap - chordLeft );

			chord.style.left = `${ nextLeft }px`;
		}

		const resolvedRect = chord.getBoundingClientRect();

		previousRightByRow.set(
			rowKey,
			resolvedRect.right - containerRect.left
		);
	} );
}

function recalculateBlockPositions(
	block,
	offset = Number( block.dataset.transposeOffset || '0' ),
	transposeSettings = getBlockTransposeSettings( block, offset )
) {
	block.querySelectorAll( '.chordpro-line-annotated' ).forEach( ( line ) => {
		recalculateLinePositions( line, offset, transposeSettings );
	} );
}

function getStorageKey( block ) {
	return block.dataset.transposeStorageKey || null;
}

function hasTransposeControls( block ) {
	return !! block.querySelector( '[data-transpose-change]' );
}

function loadOffset( block ) {
	const storageKey = getStorageKey( block );

	if ( ! storageKey || ! hasTransposeControls( block ) ) {
		return 0;
	}

	try {
		const saved = window.localStorage.getItem( storageKey );

		if ( saved === null ) {
			return 0;
		}

		const offset = Number( saved );

		return Number.isFinite( offset ) ? offset : 0;
	} catch {
		return 0;
	}
}

function saveOffset( block, offset ) {
	const storageKey = getStorageKey( block );

	if ( ! storageKey || ! hasTransposeControls( block ) ) {
		return;
	}

	try {
		if ( offset === 0 ) {
			window.localStorage.removeItem( storageKey );
			return;
		}

		window.localStorage.setItem( storageKey, String( offset ) );
	} catch {
		// Ignore storage failures and keep UI functional.
	}
}

function observeBlockSize( block ) {
	if (
		typeof window.ResizeObserver === 'undefined' ||
		blockObservers.has( block )
	) {
		return;
	}

	const observer = new window.ResizeObserver( () => {
		scheduleBlockRefresh( block );
	} );

	observer.observe( block );
	blockObservers.set( block, observer );
}

function flushQueuedBlocks() {
	refreshFrame = null;

	Array.from( queuedBlocks ).forEach( ( block ) => {
		queuedBlocks.delete( block );

		if ( block?.isConnected ) {
			recalculateBlockPositions( block );
		}
	} );
}

function scheduleBlockRefresh( block ) {
	if ( ! block ) {
		return;
	}

	queuedBlocks.add( block );

	if ( refreshFrame !== null ) {
		return;
	}

	refreshFrame = window.requestAnimationFrame( flushQueuedBlocks );
}

export function formatOffset( offset ) {
	if ( offset > 0 ) {
		return `+${ offset }`;
	}

	return `${ offset }`;
}

export function updateBlock( block, offset ) {
	if ( ! block ) {
		return;
	}

	const display = block.querySelector( '[data-transpose-display]' );
	const chordNodes = block.querySelectorAll(
		'.chordpro-chord[data-original-chord]'
	);
	const keyNode = block.querySelector( '[data-original-key]' );
	const formattedOffset = formatOffset( offset );
	const transposeSettings = getBlockTransposeSettings( block, offset );

	block.dataset.transposeOffset = String( offset );
	block.setAttribute( 'data-transpose-offset', String( offset ) );
	block.setAttribute( 'data-transpose-label', formattedOffset );

	chordNodes.forEach( ( node ) => {
		const transposed = transposeChord( node.dataset.originalChord, offset, {
			preferFlats: transposeSettings.preferFlats,
		} );

		node.textContent = transposed;
	} );

	recalculateBlockPositions( block, offset, transposeSettings );

	if ( keyNode ) {
		keyNode.textContent = transposeSettings.displayKey;
	}

	if ( display ) {
		display.textContent = formattedOffset;
		display.setAttribute(
			'aria-label',
			sprintf(
				/* translators: %s: current transpose offset, e.g. +2 */
				__( 'Transpose offset %s semitones', 'chordpro-block' ),
				formattedOffset
			)
		);
	}

	saveOffset( block, offset );

	const resetButton = block.querySelector( '[data-transpose-reset]' );

	if ( resetButton ) {
		resetButton.disabled = offset === 0;
	}
}

export function bindBlock( block ) {
	if ( block.dataset.transposeBound === 'true' ) {
		return;
	}

	const chordNodes = block.querySelectorAll(
		'.chordpro-chord[data-original-chord]'
	);

	if ( ! chordNodes.length ) {
		return;
	}

	const controlsAvailable = hasTransposeControls( block );
	let offset = controlsAvailable ? loadOffset( block ) : 0;

	if ( controlsAvailable ) {
		block
			.querySelectorAll( '[data-transpose-change]' )
			.forEach( ( button ) => {
				button.addEventListener( 'click', () => {
					offset += Number( button.dataset.transposeChange );
					updateBlock( block, offset );
				} );
			} );

		const resetButton = block.querySelector( '[data-transpose-reset]' );

		if ( resetButton ) {
			resetButton.addEventListener( 'click', () => {
				offset = 0;
				updateBlock( block, offset );
			} );
		}
	}

	block.dataset.transposeBound = 'true';
	observeBlockSize( block );
	updateBlock( block, offset );
}

export function initTransposeControls() {
	document
		.querySelectorAll( '.wp-block-chordpro-block-song' )
		.forEach( bindBlock );
}

export function refreshAllBlocks() {
	document
		.querySelectorAll(
			'.wp-block-chordpro-block-song[data-transpose-bound="true"]'
		)
		.forEach( scheduleBlockRefresh );
}
