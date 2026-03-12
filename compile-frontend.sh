#!/bin/bash
# Compile frontend JSX to JavaScript using Sucrase

echo "🔨 Compiling frontend/App.jsx..."

node -e "const {transform}=require('sucrase'),fs=require('fs');const code=fs.readFileSync('frontend/App.jsx','utf8');const r=transform(code,{transforms:['jsx'],production:true});fs.writeFileSync('frontend/App.compiled.js',r.code,'utf8');console.log('✅ Compiled successfully! Size: '+r.code.length+' bytes')"

if [ $? -eq 0 ]; then
    echo "✨ Frontend compiled successfully!"
    echo "📝 Output: frontend/App.compiled.js"
else
    echo "❌ Compilation failed!"
    exit 1
fi
