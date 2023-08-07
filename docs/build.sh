#!/bin/bash

# call from the proteinpaint project root dir
./docs/readme.sh > public/docs/readme.json

npm run doc --workspaces --if-present
# assumes `npm run doc` has autogenerated documentation under public/docs/
d3='<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/4.13.0/d3.min.js" integrity="sha512-RJJ1NNC88QhN7dwpCY8rm/6OxI+YdQP48DrLGe/eSAd+n+s1PXwQkkpzzAgoJe4cZFW2GALQoxox61gSY2yQfg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>' # pragma: allowlist secret
nav="<script src='/docs/nav.js'></script>"
subheader="<div class='docs-subheader'><span class='code-snippet'>./docs/build.sh</span> # to regenerate</div>"
# mv ./public/docs/server/index.html-e ./public/docs/server/index.html
find ./public/docs/server \( -type d -name .git -prune \) -o -type f -print0 | xargs -0 sed -i -e "s|<body>|<body>$d3$nav$subheader|g"
