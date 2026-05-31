/**
 * Buat SVG path string untuk arc
 * Konva Shape menerima data prop berupa SVG path
 */
export function arcToPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  // Validasi input: radius harus positif, semua nilai harus berupa angka
  if (
    radius <= 0 ||
    isNaN(cx) ||
    isNaN(cy) ||
    isNaN(radius) ||
    isNaN(startAngle) ||
    isNaN(endAngle)
  ) {
    return "";
  }

  // Deteksi full circle: startAngle === endAngle (atau sangat dekat)
  // Dalam kasus ini, SVG arc tidak bisa menggambar lingkaran penuh
  // dengan satu perintah A, jadi kita bagi menjadi dua setengah lingkaran.
  const angleDiff = Math.abs(endAngle - startAngle) % (2 * Math.PI);
  if (angleDiff < 1e-10) {
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);

    // Titik diametrically opposite (180° dari start)
    const xMid = cx + radius * Math.cos(startAngle + Math.PI);
    const yMid = cy + radius * Math.sin(startAngle + Math.PI);

    return (
      `M ${x1} ${y1} ` +
      `A ${radius} ${radius} 0 1 1 ${xMid} ${yMid} ` +
      `A ${radius} ${radius} 0 1 1 ${x1} ${y1}`
    );
  }

  // Normalkan agar arc selalu digambar searah jarum jam
  let start = startAngle;
  let end = endAngle;
  if (end < start) end += Math.PI * 2;

  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);

  const largeArc = end - start > Math.PI ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}
