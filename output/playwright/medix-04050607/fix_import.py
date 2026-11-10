from pathlib import Path
p=Path('output/playwright/medix-04050607/capture.py');s=p.read_text(encoding='utf-8');s=s.replace("import capture as old", "import importlib.util\nspec=importlib.util.spec_from_file_location('baseline_capture',Path('output/playwright/medix-0123/capture.py').resolve());old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)");p.write_text(s,encoding='utf-8')
