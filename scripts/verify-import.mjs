import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('data/source-manifest.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=await readFile('src/data/restaurants.generated.json');
if(hash(json)!==manifest.projectionSha256)throw new Error('Projection hash mismatch');
const data=JSON.parse(json);if(data.restaurants.length!==manifest.restaurantCount)throw new Error('Restaurant count mismatch');
for(const image of manifest.images)if(hash(await readFile(`public/${image.path}`))!==image.sha256)throw new Error(`Asset hash mismatch: ${image.path}`);
console.log(`Import verified: ${manifest.restaurantCount} restaurants / ${manifest.images.length} assets`);
