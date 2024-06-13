#! /usr/bin/bash

echo 'checking fixes.sh permissions:'
ls -l fixes.sh
echo Done

echo 'Checking simple-get > index.js file content'
file_found=$(find node_modules/simple-get -type f -exec grep -l "else return simpleGet(opts, cb)" {} \;)
echo "Found $file_found"

echo "check if $file_found is fixed"

checked=$(grep 'cb(null, res, opts.url)' $file_found)
if [ -n "$checked" ]; then
    echo "Already fixed"
else
    echo "Replacing..."
    sed -i s/.*'else return simpleGet(opts, cb)'.*/'else if(opts.url.startsWith("magnet")) return cb(null, res, opts.url) \n else return simpleGet(opts, cb)'/ $file_found
    echo "Replaced"
fi
