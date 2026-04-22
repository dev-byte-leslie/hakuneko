export default class ComicInfoGenerator {
    createComicInfoXML(series: string, title: string, pagesCount: number): string {
        series = this.escapeXML(series);
        title = this.escapeXML(title);
        return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Title>${title}</Title>
    <Series>${series}</Series>
    <PageCount>${pagesCount}</PageCount>
</ComicInfo>`;
    }

    escapeXML(str: string): string {
        const symbols: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '\'': '&apos;',
            '"': '&quot;'
        };

        return str.replace(/[<>&'"]/g, function (c) {
            return symbols[c];
        });
    }
}
