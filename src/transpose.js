const NOTES_SHARP = [
	'C',
	'C#',
	'D',
	'D#',
	'E',
	'F',
	'F#',
	'G',
	'G#',
	'A',
	'A#',
	'B',
];
const NOTES_FLAT = [
	'C',
	'Db',
	'D',
	'Eb',
	'E',
	'F',
	'Gb',
	'G',
	'Ab',
	'A',
	'Bb',
	'B',
];
const NOTE_INDEX = {
	C: 0,
	'B#': 0,
	Db: 1,
	'C#': 1,
	D: 2,
	Eb: 3,
	'D#': 3,
	E: 4,
	Fb: 4,
	F: 5,
	'E#': 5,
	Gb: 6,
	'F#': 6,
	G: 7,
	Ab: 8,
	'G#': 8,
	A: 9,
	Bb: 10,
	'A#': 10,
	B: 11,
	Cb: 11,
};

function transposeNote( note, steps ) {
	const index = NOTE_INDEX[ note ];

	if ( typeof index !== 'number' ) {
		return note;
	}

	const nextIndex = ( index + steps + 120 ) % 12;
	const scale = note.includes( 'b' ) ? NOTES_FLAT : NOTES_SHARP;

	return scale[ nextIndex ];
}

export function transposeChord( chord, steps ) {
	if ( ! steps || /^(?:N\.?C\.?)$/i.test( chord.trim() ) ) {
		return chord;
	}

	let transposed = chord.replace( /^([A-G](?:b|#)?)/, ( match ) =>
		transposeNote( match, steps )
	);

	transposed = transposed.replace(
		/\/([A-G](?:b|#)?)/,
		( _match, bassNote ) => `/${ transposeNote( bassNote, steps ) }`
	);

	return transposed;
}

let measureCanvas;

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

function measureTextWidth( text, font ) {
	const context = getMeasureContext();

	if ( ! context ) {
		return 0;
	}

	context.font = font;

	return context.measureText( text ).width;
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

function getAnchorMetrics( lyricNode, lyricChars, codeUnitOffsets, position ) {
	const textNode = lyricNode.firstChild;

	if ( ! textNode || textNode.nodeType !== 3 ) {
		return null;
	}

	if ( lyricChars.length === 0 ) {
		return { left: 0, top: 0 };
	}

	const safePosition = Math.max( 0, Math.min( position, lyricChars.length ) );
	const lyricRect = lyricNode.getBoundingClientRect();
	const range = document.createRange();

	range.setStart( textNode, codeUnitOffsets[ safePosition ] );
	range.collapse( true );

	const caretRect = Array.from( range.getClientRects() ).find(
		( currentRect ) => currentRect.width >= 0 || currentRect.height > 0
	);

	if ( caretRect ) {
		return {
			left: caretRect.left - lyricRect.left,
			top: caretRect.top - lyricRect.top,
		};
	}

	if ( safePosition < lyricChars.length ) {
		range.setStart( textNode, codeUnitOffsets[ safePosition ] );
		range.setEnd( textNode, codeUnitOffsets[ safePosition + 1 ] );

		const rect = Array.from( range.getClientRects() ).find(
			( currentRect ) => currentRect.width > 0 || currentRect.height > 0
		);

		if ( rect ) {
			return {
				left: rect.left - lyricRect.left,
				top: rect.top - lyricRect.top,
			};
		}
	}

	if ( safePosition > 0 ) {
		range.setStart( textNode, codeUnitOffsets[ safePosition - 1 ] );
		range.setEnd( textNode, codeUnitOffsets[ safePosition ] );

		const rects = Array.from( range.getClientRects() ).filter(
			( currentRect ) => currentRect.width > 0 || currentRect.height > 0
		);
		const rect = rects[ rects.length - 1 ];

		if ( rect ) {
			return {
				left: rect.right - lyricRect.left,
				top: rect.top - lyricRect.top,
			};
		}
	}

	return null;
}

function recalculateLinePositions( line, offset ) {
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
		const transposed = transposeChord( originalChord, offset );

		if ( previousBaseLyricPosition !== baseLyricPosition ) {
			chordOffset = 0;
		}

		const anchorMetrics = getAnchorMetrics(
			lyricNode,
			lyricChars,
			codeUnitOffsets,
			baseLyricPosition
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

function recalculateBlockPositions( block ) {
	block.querySelectorAll( '.chordpro-line-annotated' ).forEach( ( line ) => {
		const offset = Number( block.dataset.transposeOffset || '0' );
		recalculateLinePositions( line, offset );
	} );
}

export function formatOffset( offset ) {
	if ( offset > 0 ) {
		return `+${ offset }`;
	}

	return `${ offset }`;
}

function getStorageKey( block ) {
	const key = block.dataset.transposeStorageKey;

	if ( ! key ) {
		return null;
	}

	return key;
}

function loadOffset( block ) {
	const storageKey = getStorageKey( block );

	if ( ! storageKey ) {
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

	if ( ! storageKey ) {
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

export function updateBlock( block, offset ) {
	if ( ! block ) {
		return;
	}

	const display = block.querySelector( '[data-transpose-display]' );
	const chordNodes = block.querySelectorAll(
		'.chordpro-chord[data-original-chord]'
	);
	const keyNode = block.querySelector( '[data-original-key]' );

	chordNodes.forEach( ( node ) => {
		const transposed = transposeChord( node.dataset.originalChord, offset );
		node.textContent = transposed;
	} );

	recalculateBlockPositions( block );

	if ( keyNode ) {
		keyNode.textContent = transposeChord(
			keyNode.dataset.originalKey,
			offset
		);
	}

	if ( display ) {
		display.textContent = formatOffset( offset );
	}

	saveOffset( block, offset );

	block.dataset.transposeOffset = String( offset );
	block.setAttribute( 'data-transpose-offset', String( offset ) );
	block.setAttribute( 'data-transpose-label', formatOffset( offset ) );
	block.setAttribute(
		'aria-label',
		`Transpose offset ${ formatOffset( offset ) } semitones`
	);

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

	let offset = loadOffset( block );

	block.querySelectorAll( '[data-transpose-change]' ).forEach( ( button ) => {
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

	block.dataset.transposeBound = 'true';
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
		.forEach( recalculateBlockPositions );
}
