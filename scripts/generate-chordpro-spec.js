const fs = require( 'node:fs' );
const path = require( 'node:path' );

const rootDir = process.cwd();
const specPath = path.join( rootDir, 'src', 'chordpro-spec.json' );
const outputDir = path.join( rootDir, 'src', 'generated' );
const phpOutputPath = path.join( outputDir, 'chordpro-spec.php' );
const jsOutputPath = path.join( outputDir, 'chordpro-labels.js' );

const specJson = fs.readFileSync( specPath, 'utf8' );
const spec = JSON.parse( specJson );

function escapeJsString( value ) {
	return String( value ).replace( /\\/g, '\\\\' ).replace( /'/g, "\\'" );
}

const phpWrapper = `<?php

namespace ChordProBlock\\Parser;

function get_chordpro_shared_spec() : array {
\tstatic $spec = null;

\tif ( null !== $spec ) {
\t\treturn $spec;
\t}

\t$spec = json_decode(
\t\t<<<'JSON'
${ specJson }
JSON,
\t\ttrue
\t);

\tif ( ! is_array( $spec ) ) {
\t\treturn array();
\t}

\treturn $spec;
}
`;

const labelEntries = Object.entries( spec.labels )
	.map( ( [ key, definition ] ) => {
		const literal = `'${ escapeJsString( definition.text ) }'`;

		if ( definition.function === '_x' ) {
			return `\t\t${ key }: _x( ${ literal }, '${ escapeJsString(
				definition.context || ''
			) }', 'chordpro-block' ),`;
		}

		return `\t\t${ key }: __( ${ literal }, 'chordpro-block' ),`;
	} )
	.join( '\n' );

const jsLabels = `import { __, _x } from '@wordpress/i18n';

export function getGeneratedChordProLabels() {
\treturn {
${ labelEntries }
\t};
}
`;

fs.mkdirSync( outputDir, { recursive: true } );
fs.writeFileSync( phpOutputPath, phpWrapper );
fs.writeFileSync( jsOutputPath, jsLabels );
