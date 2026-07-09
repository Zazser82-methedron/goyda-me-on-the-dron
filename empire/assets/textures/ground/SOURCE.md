# Источник текстур

`ground_diff_1k.jpg` / `ground_nor_1k.jpg` / `ground_rough_1k.jpg` — Poly Haven, ассет **Aerial Grass Rock**
(https://polyhaven.com/a/aerial_grass_rock), лицензия **CC0** (public domain, атрибуция не требуется).
Скачано через официальный API `api.polyhaven.com/files/aerial_grass_rock`, разрешение 1k, формат jpg
(Diffuse + nor_gl + Rough).

Используется как единая деталь-текстура земли на High-тире (`world/TerrainMesh._loadRealTextures`),
поверх био́много вершинного цвета — сама текстура биом-нейтральная, красится вершинными цветами
(трава/песок/камень/снег), как и прежняя процедурная. На Low-тире (мобила) не грузится вовсе.
