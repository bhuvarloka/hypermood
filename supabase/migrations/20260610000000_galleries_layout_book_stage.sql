ALTER TABLE galleries DROP CONSTRAINT galleries_layout_check;
ALTER TABLE galleries ADD CONSTRAINT galleries_layout_check
  CHECK (layout IN ('masonry', 'timeline', 'book', 'stage'));
