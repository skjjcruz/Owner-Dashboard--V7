const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('2026-Dynasty.csv.xlsx');

// Get the first worksheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to CSV
const csv = XLSX.utils.sheet_to_csv(worksheet);

// Write to file
fs.writeFileSync('2026-Dynasty.csv', csv);

console.log('✅ Converted 2026-Dynasty.csv.xlsx to 2026-Dynasty.csv');
