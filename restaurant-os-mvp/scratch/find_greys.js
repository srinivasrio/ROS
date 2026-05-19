const fs = require('fs');

const content = fs.readFileSync('app/components/shared/homepage/SharedHomepageLayout.tsx', 'utf8');
const hexRegex = /#([0-9a-fA-F]{3,6})/g;
let match;
const greys = [];

function isGrey(hex) {
    if (hex.length === 4) {
        const r = parseInt(hex[1], 16);
        const g = parseInt(hex[2], 16);
        const b = parseInt(hex[3], 16);
        return Math.abs(r - g) < 2 && Math.abs(g - b) < 2 && Math.abs(r - b) < 2;
    } else if (hex.length === 7) {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        return Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
    }
    return false;
}

while ((match = hexRegex.exec(content)) !== null) {
    const hex = match[0];
    if (isGrey(hex) && hex !== '#ffffff' && hex !== '#000000' && hex !== '#0a0a0a' && hex !== '#171717') {
        greys.push(hex);
    }
}

console.log(JSON.stringify([...new Set(greys)], null, 2));
