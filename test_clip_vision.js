import { CLIPVisionModel, AutoProcessor, RawImage } from './node_modules/@xenova/transformers/src/transformers.js';

async function test() {
    try {
        console.log("Loading CLIPVisionModel...");
        const model = await CLIPVisionModel.from_pretrained('Xenova/clip-vit-base-patch32');
        console.log("Loading processor...");
        const processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');
        
        console.log("Creating dummy image...");
        const img = new RawImage(new Uint8ClampedArray(224*224*4), 224, 224, 4);
        const inputs = await processor(img);
        
        console.log("Running model...");
        const outputs = await model(inputs);
        
        console.log("Output keys:", Object.keys(outputs));
        for (const key of Object.keys(outputs)) {
            console.log(`${key} dims:`, outputs[key].dims);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
