const NOTES_SHARP = [ 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B' ];
const NOTES_FLAT = [ 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B' ];
const NOTE_INDEX = {
	C: 0,
	'B#': 0,
	'Db': 1,
	'C#': 1,
	D: 2,
	'Eb': 3,
	'D#': 3,
	E: 4,
	Fb: 4,
	F: 5,
	'E#': 5,
	'Gb': 6,
	'F#': 6,
	G: 7,
	'Ab': 8,
	'G#': 8,
	A: 9,
	'Bb': 10,
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

function transposeChord( chord, steps ) {
	if ( ! steps || /^(?:N\.?C\.?)$/i.test( chord.trim() ) ) {
		return chord;
	}

	let transposed = chord.replace(
		/^([A-G](?:b|#)?)/,
		( match ) => transposeNote( match, steps )
	);

	transposed = transposed.replace(
		/\/([A-G](?:b|#)?)/,
		( _match, bassNote ) => `/${ transposeNote( bassNote, steps ) }`
	);

	return transposed;
}

function formatOffset( offset ) {
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

function updateBlock( block, offset ) {
	const display = block.querySelector( '[data-transpose-display]' );
	const chordNodes = block.querySelectorAll( '.chordpro-chord[data-original-chord]' );
	const keyNode = block.querySelector( '[data-original-key]' );

	chordNodes.forEach( ( node ) => {
		node.textContent = transposeChord( node.dataset.originalChord, offset );
	} );

	if ( keyNode ) {
		keyNode.textContent = transposeChord( keyNode.dataset.originalKey, offset );
	}

	if ( display ) {
		display.textContent = formatOffset( offset );
	}

	saveOffset( block, offset );

	block.dataset.transposeOffset = String( offset );
	block.setAttribute( 'data-transpose-offset', String( offset ) );
	block.setAttribute( 'data-transpose-label', formatOffset( offset ) );
	block.setAttribute( 'aria-label', `Transpose offset ${ formatOffset( offset ) } semitones` );
	const resetButton = block.querySelector( '[data-transpose-reset]' );
	if ( resetButton ) {
		resetButton.disabled = offset === 0;
	}
}

function bindBlock( block ) {
	if ( block.dataset.transposeBound === 'true' ) {
		return;
	}

	const chordNodes = block.querySelectorAll( '.chordpro-chord[data-original-chord]' );

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

function initTransposeControls() {
	document
		.querySelectorAll( '.wp-block-chordpro-block-song' )
		.forEach( bindBlock );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initTransposeControls );
} else {
	initTransposeControls();
}