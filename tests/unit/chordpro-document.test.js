const fixtures = require( '../fixtures/parser-cases.json' );

jest.mock(
	'@wordpress/i18n',
	() => ( {
		__: ( value ) => value,
		_x: ( value ) => value,
	} ),
	{ virtual: true }
);

const {
	createChordProDocument,
	renderChordProDocument,
} = require( '../../src/chordpro-parser' );

describe( 'ChordPro document fixtures', () => {
	test.each( fixtures )( '$name', ( fixture ) => {
		const document = createChordProDocument( fixture.input );
		const html = renderChordProDocument( document, {
			showTitle: true,
			showArtist: true,
		} );

		Object.entries( fixture.expected.meta ).forEach( ( [ key, value ] ) => {
			expect( document.meta[ key ] ).toBe( value );
		} );

		Object.entries( fixture.expected.features ).forEach(
			( [ key, value ] ) => {
				expect( document.features[ key ] ).toBe( value );
			}
		);

		expect( document.nodes.map( ( node ) => node.type ) ).toEqual(
			fixture.expected.nodeTypes
		);

		expect( html ).toBe( fixture.expected.html );
	} );
} );
