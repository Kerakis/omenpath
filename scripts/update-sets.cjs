/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SCRYFALL_SETS_URL = 'https://api.scryfall.com/sets';
const OUTPUT_PATH = path.join(__dirname, '..', 'static', 'data', 'sets.json');

async function fetchSets() {
	return new Promise((resolve, reject) => {
		const options = {
			headers: {
				'User-Agent': 'Omenpath/1.0',
				Accept: 'application/json'
			}
		};

		https
			.get(SCRYFALL_SETS_URL, options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					try {
						const json = JSON.parse(data);
						resolve(json);
					} catch (error) {
						reject(error);
					}
				});
			})
			.on('error', (error) => {
				reject(error);
			});
	});
}

async function updateSets() {
	try {
		console.log('Fetching sets from Scryfall API...');
		const response = await fetchSets();

		if (!response.data) {
			throw new Error('Invalid response format - no data property');
		}

		// Extract only the data we need
		const sets = response.data.map((set) => ({
			code: set.code,
			name: set.name
		}));

		// Ensure output directory exists
		const outputDir = path.dirname(OUTPUT_PATH);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Write the sets data
		fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sets, null, 2));

		console.log(`Successfully updated sets data with ${sets.length} sets`);
		console.log(`Data written to: ${OUTPUT_PATH}`);
	} catch (error) {
		console.error('Error updating sets:', error);
		process.exit(1);
	}
}

// Run the update
updateSets();
