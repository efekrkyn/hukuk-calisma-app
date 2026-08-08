-- D1 tam export'u FTS5 sanal tablolarını desteklemediği için yalnız gölge
-- içerik taşınır; gerçek tablo yeniden kurulmadan aynı adlı gölge tablo çakışır.
ALTER TABLE fts_chunks_content RENAME TO fts_chunks_content_yedek;

CREATE VIRTUAL TABLE fts_chunks USING fts5(
  id UNINDEXED,
  course UNINDEXED,
  pdf UNINDEXED,
  page_start UNINDEXED,
  page_end UNINDEXED,
  text,
  tokenize="unicode61"
);

INSERT INTO fts_chunks(rowid, id, course, pdf, page_start, page_end, text)
SELECT id, c0, c1, c2, c3, c4, c5
FROM fts_chunks_content_yedek;

DROP TABLE fts_chunks_content_yedek;
