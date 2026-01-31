// Script to upload ONNX model to Supabase Storage
// Run with: node upload_model.cjs

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://wrwlibyrpoqknaycwlex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyd2xpYnlycG9xa25heWN3bGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTcxMzEsImV4cCI6MjA4NDU5MzEzMX0.y8nlF4Nn11h0rtiBAbHY4gyP-DR7fTXBdVLb-O54MAA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function uploadModel() {
    const modelPath = path.join(__dirname, 'public/models/tiang_model.onnx');

    console.log('📦 Reading model file...');
    const fileBuffer = fs.readFileSync(modelPath);
    console.log(`File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    console.log('⬆️ Uploading to Supabase Storage...');
    const { data, error } = await supabase.storage
        .from('models')
        .upload('tiang_model.onnx', fileBuffer, {
            contentType: 'application/octet-stream',
            upsert: true
        });

    if (error) {
        console.error('❌ Upload failed:', error);
        return;
    }

    console.log('✅ Upload successful!');

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('models')
        .getPublicUrl('tiang_model.onnx');

    console.log('🔗 Model URL:', urlData.publicUrl);
}

uploadModel();
