# OmenPath - MTG Collection CSV Converter

OmenPath is a web application that converts Magic: The Gathering collection CSV files from various apps and websites into Moxfield-compatible format. It uses the Scryfall API to ensure accurate card identification and data.

## Features

- **Universal CSV Support**: Supports CSV files from 12+ popular MTG collection apps including:

  - Archidekt
  - CardCastle (Full & Simple formats)
  - CubeCobra
  - DeckBox
  - DelverLens
  - DragonShield (App & Web)
  - Magic Online (MTGO)
  - Moxfield (passthrough)
  - TCGPlayer
  - And more...

- **Auto-Detection**: Automatically detects CSV format based on column headers
- **Preview Mode**: Preview parsed data before conversion to catch issues early
- **Batch Processing**: Handle multiple files at once
- **Rate Limiting**: Respects Scryfall API rate limits (10 requests/second)
- **Dual Output**: Generate both CSV and TXT formats for different Moxfield import needs
- **Error Handling**: Comprehensive error reporting and recovery

## How It Works

1. **Upload**: Drag & drop or select CSV files from your collection apps
2. **Preview**: Review parsed card data and statistics
3. **Convert**: Process cards using Scryfall's collection endpoint for accuracy
4. **Download**: Get Moxfield-ready CSV or TXT files

## Supported Data Fields

The converter handles these card attributes:

- **Count**: Number of copies
- **Name**: Card name
- **Edition**: Set code
- **Collector Number**: Card number within set
- **Condition**: Card condition (Near Mint, Lightly Played, etc.)
- **Language**: Card language
- **Foil**: Foil status (foil, etched, normal)
- **Purchase Price**: What you paid for the card

## Card Identification Priority

For maximum accuracy, the converter uses this identification hierarchy:

1. **Scryfall ID** (most accurate)
2. **Multiverse ID**
3. **MTGO ID**
4. **Name + Set + Collector Number** (requires Scryfall lookup)

## Getting Started

### Prerequisites

- Node.js 18+
- Modern web browser
- Internet connection (for Scryfall API)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/omenpath.git
cd omenpath

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Building for Production

```bash
npm run build
npm run preview
```

## Usage

### Step 1: Upload Files

- Drag and drop CSV files or click to browse
- Multiple files are supported
- Only CSV files are accepted

### Step 2: Select Format (Optional)

- Use "Auto-detect" for most files (recommended)
- Manually select format if auto-detection fails
- Preview shows detected format

### Step 3: Preview Data

- Click "Preview Data" to parse without API calls
- Review card counts and identification status
- Check for potential issues before conversion

### Step 4: Convert

- Click "Convert to Moxfield Format" to start processing
- Progress bar shows API request progress
- Respects Scryfall rate limits (may take time for large collections)

### Step 5: Download

- **CSV Format**: For Moxfield collection import
- **TXT Format**: For Moxfield deck lists

## Supported CSV Formats

### Archidekt

- ✅ Scryfall ID included
- ✅ Complete metadata
- ✅ Condition mapping

### CardCastle

- **Full Format**: ✅ Scryfall ID (as "JSON ID")
- **Simple Format**: ⚠️ Name/Set lookup required
- ✅ Condition and foil status

### DeckBox

- ✅ Scryfall ID included
- ✅ Complete metadata
- ✅ Condition mapping

### DragonShield

- **App Format**: ⚠️ Name/Set lookup
- **Web Format**: ⚠️ Name/Set lookup
- ✅ Condition mapping (custom logic)

### Others

Most other formats use name/set/collector number lookup.

## API Usage & Rate Limits

OmenPath uses the [Scryfall API](https://scryfall.com/docs/api) responsibly:

- **Rate Limit**: 10 requests per second maximum
- **Batch Size**: 75 cards per request (Scryfall limit)
- **Delay**: 100ms between requests
- **User Agent**: Proper identification as "OmenPath/1.0"

Large collections may take several minutes to process.

## Error Handling

Common issues and solutions:

### Cards Not Found

- Check card names for typos
- Verify set codes match Scryfall
- Some promo cards may not be available

### Format Detection Failed

- Manually select the correct format
- Check that CSV has proper headers
- Ensure file is valid CSV format

### API Errors

- Check internet connection
- Scryfall may be experiencing issues
- Retry after a few minutes

## Technical Details

### Built With

- **SvelteKit 2+**: Modern web framework
- **Svelte 5+**: Reactive UI components
- **Tailwind CSS 4+**: Utility-first styling
- **TypeScript**: Type safety
- **Vite**: Fast build tool

### Architecture

- **Frontend Only**: No backend required
- **Client-side Processing**: All CSV parsing in browser
- **API Integration**: Direct Scryfall API calls
- **Progressive Enhancement**: Works without JavaScript for basic features

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new CSV formats
4. Submit a pull request

### Adding New Formats

To add support for a new CSV format:

1. Add format definition to `src/lib/converter-engine.ts`
2. Define column mappings and transformations
3. Add to format selector in `src/lib/FormatSelector.svelte`
4. Test with sample files

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Scryfall**: For their amazing API and card database
- **MTG Community**: For feedback and CSV format examples
- **Wizards of the Coast**: For Magic: The Gathering

## Disclaimer

OmenPath is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Magic: The Gathering is copyright Wizards of the Coast, LLC. This project is not produced by or endorsed by Wizards of the Coast.

---

**Need help?** Open an issue on GitHub or contact the maintainers.

**Found a bug?** Please report it with sample CSV files (remove personal data first).

**Missing a format?** Submit a feature request with example CSV files.
