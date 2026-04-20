const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { spawnSync } = require( 'node:child_process' );

const rootDir = process.cwd();
const fixturePath = path.join( rootDir, 'tests/fixtures/parser-cases.json' );
const fixtures = JSON.parse( fs.readFileSync( fixturePath, 'utf8' ) );

const phpCheck = spawnSync( 'php', [ '-v' ], {
	encoding: 'utf8',
} );

if ( phpCheck.status !== 0 ) {
	process.stdout.write(
		'Skipping PHP parity tests because `php` is not available.\n'
	);
	process.exit( 0 );
}

const phpRun = spawnSync(
	'php',
	[ 'tests/php/export-parity.php', 'tests/fixtures/parser-cases.json' ],
	{
		cwd: rootDir,
		encoding: 'utf8',
	}
);

if ( phpRun.status !== 0 ) {
	process.stderr.write( `${ phpRun.stderr || phpRun.stdout }\n` );
	process.exit( phpRun.status || 1 );
}

const phpPayload = JSON.parse( phpRun.stdout );
const mismatches = [];

fixtures.forEach( ( fixture, index ) => {
	const phpFixture = phpPayload[ index ];

	if ( ! phpFixture ) {
		mismatches.push( {
			name: fixture.name,
			reason: 'Missing PHP fixture output.',
		} );
		return;
	}

	Object.entries( fixture.expected.meta ).forEach( ( [ key, value ] ) => {
		if ( phpFixture.meta?.[ key ] !== value ) {
			mismatches.push( {
				name: fixture.name,
				reason: `Meta mismatch for ${ key }. Expected "${ value }", received "${ phpFixture.meta?.[ key ] }".`,
			} );
		}
	} );

	Object.entries( fixture.expected.features ).forEach( ( [ key, value ] ) => {
		if ( phpFixture.features?.[ key ] !== value ) {
			mismatches.push( {
				name: fixture.name,
				reason: `Feature mismatch for ${ key }. Expected "${ value }", received "${ phpFixture.features?.[ key ] }".`,
			} );
		}
	} );

	if (
		JSON.stringify( phpFixture.nodeTypes ) !==
		JSON.stringify( fixture.expected.nodeTypes )
	) {
		mismatches.push( {
			name: fixture.name,
			reason: `Node type mismatch. Expected ${ JSON.stringify(
				fixture.expected.nodeTypes
			) }, received ${ JSON.stringify( phpFixture.nodeTypes ) }.`,
		} );
	}

	if ( phpFixture.html !== fixture.expected.html ) {
		mismatches.push( {
			name: fixture.name,
			reason: 'Rendered HTML does not match the shared fixture snapshot.',
		} );
	}
} );

if ( mismatches.length ) {
	process.stderr.write(
		'PHP parser fixture mismatches detected against shared fixtures:\n'
	);
	mismatches.forEach( ( mismatch ) => {
		process.stderr.write( `- ${ mismatch.name }: ${ mismatch.reason }\n` );
	} );
	process.exit( 1 );
}

process.stdout.write(
	`PHP parser fixtures passed for ${ fixtures.length } shared cases.\n`
);
