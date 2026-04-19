import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import {
	useBlockProps,
	InspectorControls,
	BlockControls,
	__experimentalColorGradientSettingsDropdown as ColorGradientSettingsDropdown,
	__experimentalUseMultipleOriginColorsAndGradients as useMultipleOriginColorsAndGradients,
} from '@wordpress/block-editor';
import {
	TextareaControl,
	Placeholder,
	ToolbarGroup,
	ToolbarButton,
	ToggleControl,
	PanelBody,
	SelectControl,
} from '@wordpress/components';
import { parseChordPro } from './chordpro-parser';
import { formatOffset, updateBlock } from './transpose';

/**
 * Editor component for the ChordPro block.
 *
 * Shows a textarea for raw ChordPro input and an optional rendered preview.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const { content, chordColor, showTitle, showArtist, fontFamily } = attributes;
	const blockProps = useBlockProps();
	const colorGradientSettings = useMultipleOriginColorsAndGradients();
	const [ isPreviewMode, setIsPreviewMode ] = useState( false );
	const [ transposeOffset, setTransposeOffset ] = useState( 0 );
	const previewRef = useRef();

	useEffect( () => {
		if ( ! isPreviewMode || ! previewRef.current ) {
			return;
		}

		updateBlock( previewRef.current, transposeOffset );
	}, [ content, isPreviewMode, showTitle, showArtist, transposeOffset ] );

	return (
		<div { ...blockProps }>
			<BlockControls>
				<ToolbarGroup>
					<ToolbarButton
						isPressed={ ! isPreviewMode }
						onClick={ () => setIsPreviewMode( false ) }
					>
						{ __( 'ChordPro', 'chordpro-block' ) }
					</ToolbarButton>
					<ToolbarButton
						isPressed={ isPreviewMode }
						onClick={ () => setIsPreviewMode( true ) }
					>
						{ __( 'Preview', 'chordpro-block' ) }
					</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls group="color">
				<ColorGradientSettingsDropdown
					{ ...colorGradientSettings }
					panelId={ clientId }
					settings={ [
						{
							label: __( 'Chords', 'chordpro-block' ),
							colorValue: chordColor,
							onColorChange: ( value ) =>
								setAttributes( {
											   chordColor: value || '',
								} ),
						},
					] }
					__experimentalIsRenderedInSidebar={ true }
				/>
			</InspectorControls>

			   <InspectorControls>
				   <PanelBody
					   title={ __( 'Display', 'chordpro-block' ) }
					   initialOpen={ true }
				   >
					   <ToggleControl
						   label={ __( 'Show song title', 'chordpro-block' ) }
						   help={ __(
							   'Display the title extracted from {title: ...} or {t: ...}.',
							   'chordpro-block'
						   ) }
						   checked={ !! showTitle }
						   onChange={ ( value ) =>
							   setAttributes( { showTitle: value } )
						   }
					   />
					   <ToggleControl
						   label={ __( 'Show song artist', 'chordpro-block' ) }
						   help={ __(
							   'Display the artist extracted from {artist: ...}.',
							   'chordpro-block'
						   ) }
						   checked={ !! showArtist }
						   onChange={ ( value ) =>
							   setAttributes( { showArtist: value } )
						   }
					   />
				   </PanelBody>
			   </InspectorControls>

			   <InspectorControls group="styles">
				   <PanelBody
					   title={ __( 'Styles', 'chordpro-block' ) }
					   initialOpen={ false }
				   >
					   <SelectControl
						   label={ __( 'Font family', 'chordpro-block' ) }
						   value={ fontFamily || 'default' }
						   options={ [
							   {
								   label: __( 'Default (Courier New)', 'chordpro-block' ),
								   value: 'default',
							   },
							   {
								   label: __( 'Roboto Mono', 'chordpro-block' ),
								   value: 'roboto',
							   },
							   {
								   label: __( 'Martian Mono', 'chordpro-block' ),
								   value: 'martian',
							   },
						   ] }
						   onChange={ ( value ) =>
							   setAttributes( { fontFamily: value } )
						   }
					   />
				   </PanelBody>
			   </InspectorControls>

			{ ! isPreviewMode ? (
				<TextareaControl
					className="chordpro-editor__textarea"
					label={ __( 'ChordPro content', 'chordpro-block' ) }
					help={ __(
						'Write your song using ChordPro notation. Place chords inline with [Chord] and use {directive: value} for metadata and section markers.',
						'chordpro-block'
					) }
					value={ content }
					onChange={ ( value ) => setAttributes( { content: value } ) }
					rows={ 12 }
					__nextHasNoMarginBottom={ true }
				/>
			) : content ? (
				<div className="chordpro-editor__preview" ref={ previewRef }>
					<div
						className="chordpro-transpose-controls"
						role="group"
						aria-label={ __( 'Transpose chords', 'chordpro-block' ) }
					>
						<div className="chordpro-meta-key-row">
							<strong>{ __( 'Transpose', 'chordpro-block' ) }:</strong>
							<button
								type="button"
								className="chordpro-transpose-button"
								onClick={ () =>
									setTransposeOffset( ( value ) => value - 1 )
								}
								aria-label={ __(
									'Lower one semitone',
									'chordpro-block'
								) }
							>
								-
							</button>
							<button
								type="button"
								className="chordpro-transpose-button"
								onClick={ () =>
									setTransposeOffset( ( value ) => value + 1 )
								}
								aria-label={ __(
									'Raise one semitone',
									'chordpro-block'
								) }
							>
								+
							</button>
							<button
								type="button"
								className="chordpro-transpose-reset"
								onClick={ () => setTransposeOffset( 0 ) }
								data-transpose-reset
								disabled={ transposeOffset === 0 }
							>
								{ __( 'Reset', 'chordpro-block' ) }
							</button>
							<span
								className="chordpro-editor__transpose-value"
								data-transpose-display
							>
								{ formatOffset( transposeOffset ) }
							</span>
						</div>
					</div>
					<div
						className={ [
							'chordpro-song',
							fontFamily === 'roboto' && 'chordpro-font-roboto',
							fontFamily === 'martian' && 'chordpro-font-martian',
						]
							.filter( Boolean )
							.join( ' ' ) }
						style={ {
							'--chordpro-chord-color': chordColor || '#c0392b',
						} }
						// Content is generated by our own parser which escapes all user text.
						// eslint-disable-next-line react/no-danger
						dangerouslySetInnerHTML={ {
							__html: parseChordPro( content, {
								showTitle,
								showArtist,
							} ),
						} }
					/>
				</div>
			) : (
				<Placeholder
					icon="format-audio"
					label={ __( 'ChordPro', 'chordpro-block' ) }
					instructions={ __(
						'Start typing your song in the textarea above using ChordPro notation.',
						'chordpro-block'
					) }
				/>
			) }
		</div>
	);
}
