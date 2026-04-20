<?php

require_once dirname( __DIR__, 2 ) . '/src/parser.php';

if ( empty( $argv[1] ) || ! file_exists( $argv[1] ) ) {
	fwrite( STDERR, "Fixture file not found.\n" );
	exit( 1 );
}

$fixtures = json_decode( file_get_contents( $argv[1] ), true );

if ( ! is_array( $fixtures ) ) {
	fwrite( STDERR, "Invalid fixture payload.\n" );
	exit( 1 );
}

$payload = array();

foreach ( $fixtures as $fixture ) {
	$document = \ChordProBlock\Parser\parse_chordpro_document( $fixture['input'] );
	$html     = \ChordProBlock\Parser\render_chordpro_document(
		$document,
		array(
			'showTitle'  => true,
			'showArtist' => true,
		)
	);

	$payload[] = array(
		'name'      => $fixture['name'],
		'meta'      => $document['meta'],
		'features'  => $document['features'],
		'nodeTypes' => array_map(
			static function ( array $node ) : string {
				return $node['type'];
			},
			$document['nodes']
		),
		'html'      => $html,
	);
}

echo json_encode( $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );

