fetch('https://www.youtube.com/@rajeshguleria1973').then(r=>r.text()).then(t => {
  const match = t.match(/https:\/\/www\.youtube\.com\/channel\/([^"]+)/);
  console.log(match ? match[1] : 'not found');
});
