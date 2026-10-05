const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [search, replace] of replacements) {
        if (content.includes(search) || search instanceof RegExp) {
            content = content.replace(search, replace);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

// Fix BlogPage
let bp = path.join(__dirname, 'src', 'pages', 'BlogPage.tsx');
if(fs.existsSync(bp)) {
    let c = fs.readFileSync(bp, 'utf8');
    c = c.replace(/new Date\(post\.createdAt\)/g, "new Date(post.createdAt || post.publishedAt || new Date())");
    fs.writeFileSync(bp, c, 'utf8');
}

// Fix BookAppointmentPage
let bap = path.join(__dirname, 'src', 'pages', 'BookAppointmentPage.tsx');
if(fs.existsSync(bap)) {
    let c = fs.readFileSync(bap, 'utf8');
    c = c.replace(/const appointmentDate = new Date\(`\$\{formData\.date\}T\$\{formData\.time\}`\);\n/g, "");
    fs.writeFileSync(bap, c, 'utf8');
}

// Fix ChannelPage
let cp = path.join(__dirname, 'src', 'pages', 'ChannelPage.tsx');
if(fs.existsSync(cp)) {
    let c = fs.readFileSync(cp, 'utf8');
    c = c.replace(/const \[settings, setSettings\] = useState<Record<string, string>>\({}\);\n/g, "");
    c = c.replace(/const res2 = await api\.get\('\/settings'\);\n\s*setSettings\(res2\.data\);\n/g, "await api.get('/settings');\n");
    c = c.replace(/setSettings\(res2\.data\);/g, "");
    fs.writeFileSync(cp, c, 'utf8');
}

// Fix HomePage
let hp = path.join(__dirname, 'src', 'pages', 'HomePage.tsx');
if(fs.existsSync(hp)) {
    let c = fs.readFileSync(hp, 'utf8');
    c = c.replace(/import type \{ Service, Testimonial \} from '\.\.\/types';/g, "import type { Service } from '../types';");
    c = c.replace(/const testimonialsRes = await api\.get\('\/testimonials'\);\n/g, "await api.get('/testimonials');\n");
    c = c.replace(/const testimonialsRes = await api\.get\('\/testimonials'\);/g, "await api.get('/testimonials');");
    fs.writeFileSync(hp, c, 'utf8');
}

// Fix TrackRequestPage
let trp = path.join(__dirname, 'src', 'pages', 'TrackRequestPage.tsx');
if(fs.existsSync(trp)) {
    let c = fs.readFileSync(trp, 'utf8');
    c = c.replace(/doc\.documentType/g, "doc.type || doc.name");
    fs.writeFileSync(trp, c, 'utf8');
}

console.log('Fixed frontend types');
