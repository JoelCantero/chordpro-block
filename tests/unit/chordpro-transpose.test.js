const {
	getTransposeContext,
	isTransposableChord,
	transposeChord,
	transposeKey,
} = require( '../../src/chordpro-transpose' );

describe( 'ChordPro transpose helpers', () => {
	it( 'detects transposable chords correctly', () => {
		expect( isTransposableChord( 'Cmaj7' ) ).toBe( true );
		expect( isTransposableChord( 'N.C.' ) ).toBe( false );
	} );

	it( 'respects key-based enharmonic preferences', () => {
		expect( getTransposeContext( 'F', 1 ) ).toEqual( {
			displayKey: 'Gb',
			preferFlats: true,
		} );
		expect( transposeChord( 'C', 1, { preferFlats: true } ) ).toBe( 'Db' );
	} );

	it( 'transposes slash chords consistently', () => {
		expect( transposeChord( 'C/E', 1, { preferFlats: true } ) ).toBe(
			'Db/F'
		);
	} );

	it( 'transposes key values using common key signatures', () => {
		expect( transposeKey( 'Am', 2 ) ).toBe( 'Bm' );
		expect( transposeKey( 'F', 1 ) ).toBe( 'Gb' );
	} );
} );
