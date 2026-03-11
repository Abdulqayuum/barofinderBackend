INSERT INTO languages (id, name)
SELECT UUID(), 'Amharic'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Amharic')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Oromo'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Oromo')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Tigrinya'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Tigrinya')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Hausa'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Hausa')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Yoruba'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Yoruba')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Igbo'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Igbo')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Zulu'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Zulu')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Xhosa'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Xhosa')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Kinyarwanda'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Kinyarwanda')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Kirundi'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Kirundi')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Luganda'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Luganda')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Lingala'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Lingala')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Shona'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Shona')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Afrikaans'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Afrikaans')
);

INSERT INTO languages (id, name)
SELECT UUID(), 'Portuguese'
WHERE NOT EXISTS (
  SELECT 1 FROM languages WHERE LOWER(name) = LOWER('Portuguese')
);
