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

const MAJOR_KEY_ROOTS = {
	0: 'C',
	1: 'Db',
	2: 'D',
	3: 'Eb',
	4: 'E',
	5: 'F',
	6: 'Gb',
	7: 'G',
	8: 'Ab',
	9: 'A',
	10: 'Bb',
	11: 'B',
};

const MINOR_KEY_ROOTS = {
	0: 'C',
	1: 'C#',
	2: 'D',
	3: 'Eb',
	4: 'E',
	5: 'F',
	6: 'F#',
	7: 'G',
	8: 'G#',
	9: 'A',
	10: 'Bb',
	11: 'B',
};

const NC_CHORD_RE = /^(?:N\.?C\.?)$/i;

function getNextIndex( index, steps ) {
	return ( index + steps + 120 ) % 12;
}

function parseKeySignature( value ) {
	if ( ! value ) {
		return null;
	}

	const match = String( value )
		.trim()
		.match( /^([A-G](?:b|#)?)(.*)$/ );

	if ( ! match ) {
		return null;
	}

	const root = match[ 1 ];
	const suffix = match[ 2 ] || '';
	const index = NOTE_INDEX[ root ];

	if ( typeof index !== 'number' ) {
		return null;
	}

	const normalizedSuffix = suffix.trim().toLowerCase();
	const isMinor =
		normalizedSuffix === 'm' ||
		normalizedSuffix.startsWith( 'm ' ) ||
		normalizedSuffix.startsWith( 'min' );

	return {
		index,
		isMinor,
		suffix,
	};
}

function getCanonicalKeyName( index, isMinor ) {
	const keyMap = isMinor ? MINOR_KEY_ROOTS : MAJOR_KEY_ROOTS;

	return keyMap[ index ] || NOTES_SHARP[ index ];
}

function getPreferFlatsForNote( note, preferFlats ) {
	if ( typeof preferFlats === 'boolean' ) {
		return preferFlats;
	}

	return note.includes( 'b' );
}

export function isTransposableChord( chord ) {
	if ( ! chord ) {
		return false;
	}

	const trimmed = String( chord ).trim();

	return ! NC_CHORD_RE.test( trimmed ) && /^([A-G](?:b|#)?)/.test( trimmed );
}

export function transposeNote( note, steps, options = {} ) {
	const index = NOTE_INDEX[ note ];

	if ( typeof index !== 'number' ) {
		return note;
	}

	const nextIndex = getNextIndex( index, steps );
	const scale = getPreferFlatsForNote( note, options.preferFlats )
		? NOTES_FLAT
		: NOTES_SHARP;

	return scale[ nextIndex ];
}

export function getTransposeContext( originalKey, steps ) {
	const parsed = parseKeySignature( originalKey );

	if ( ! parsed ) {
		return null;
	}

	const displayKey =
		getCanonicalKeyName(
			getNextIndex( parsed.index, steps ),
			parsed.isMinor
		) + parsed.suffix;

	return {
		displayKey,
		preferFlats: displayKey.includes( 'b' ),
	};
}

export function transposeKey( key, steps ) {
	if ( ! steps ) {
		return key;
	}

	const context = getTransposeContext( key, steps );

	return context ? context.displayKey : key;
}

export function transposeChord( chord, steps, options = {} ) {
	if ( ! steps || ! isTransposableChord( chord ) ) {
		return chord;
	}

	const preferFlats = options.preferFlats;

	let transposed = chord.replace( /^([A-G](?:b|#)?)/, ( match ) =>
		transposeNote( match, steps, {
			preferFlats,
		} )
	);

	transposed = transposed.replace(
		/\/([A-G](?:b|#)?)/,
		( _match, bassNote ) =>
			`/${ transposeNote( bassNote, steps, {
				preferFlats,
			} ) }`
	);

	return transposed;
}
