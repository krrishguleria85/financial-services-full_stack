const fs = require('fs');
const path = require('path');

// Fix ChannelPage
let cp = path.join(__dirname, 'src', 'pages', 'ChannelPage.tsx');
if(fs.existsSync(cp)) {
    let c = fs.readFileSync(cp, 'utf8');
    c = c.replace(/setSettings\(res2\.data\);/g, ""); // if there's any left
    fs.writeFileSync(cp, c, 'utf8');
}

// Fix HomePage
let hp = path.join(__dirname, 'src', 'pages', 'HomePage.tsx');
if(fs.existsSync(hp)) {
    let c = fs.readFileSync(hp, 'utf8');
    c = c.replace(/import type \{ Service, Testimonial \} from '\.\.\/types';/g, "import type { Service } from '../types';");
    c = c.replace(/const testimonialsRes = await api\.get\('\/testimonials'\);/g, "await api.get('/testimonials');");
    fs.writeFileSync(hp, c, 'utf8');
}

// Fix TrackRequestPage
let trp = path.join(__dirname, 'src', 'pages', 'TrackRequestPage.tsx');
if(fs.existsSync(trp)) {
    let c = fs.readFileSync(trp, 'utf8');
    c = c.replace(/doc\.type \|\| doc\.name/g, "doc.name");
    fs.writeFileSync(trp, c, 'utf8');
}
