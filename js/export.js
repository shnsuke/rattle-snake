/* Exports a workout template as a Zwift .zwo file so a generated level
 * can be ridden with ERG mode in Zwift/other trainer apps, not just in
 * this app's own player.
 */
(function (global) {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function blockToXML(block) {
    if (block.type === 'steady') {
      return `<SteadyState Duration="${block.duration}" Power="${(block.power / 100).toFixed(3)}"/>`;
    }
    if (block.type === 'intervals') {
      let xml = '';
      if (block.kick) {
        xml += `<SteadyState Duration="${block.kick.duration}" Power="${(block.kick.power / 100).toFixed(3)}"/>`;
      }
      xml += `<IntervalsT Repeat="${block.reps}" OnDuration="${block.on.duration}" OffDuration="${block.off.duration}" OnPower="${(block.on.power / 100).toFixed(3)}" OffPower="${(block.off.power / 100).toFixed(3)}"/>`;
      return xml;
    }
    return '';
  }

  function generateZWO(template, meta) {
    meta = meta || {};
    const name = meta.name || 'Rattlesnake';
    const desc = meta.description || 'VO2max interval workout';
    const body = template.map(blockToXML).join('\n        ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>${esc(meta.author || 'Rattlesnake App')}</author>
    <name>${esc(name)}</name>
    <description>${esc(desc)}</description>
    <sportType>bike</sportType>
    <tags/>
    <workout>
        ${body}
    </workout>
</workout_file>
`;
  }

  function downloadZWO(template, meta) {
    const xml = generateZWO(template, meta);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(meta && meta.name) || 'rattlesnake'}.zwo`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  global.RSExport = { generateZWO, downloadZWO };
})(window);
