import { createRequire } from "module";

const require = createRequire(import.meta.url);

const requiredPackages = ["yet-another-react-lightbox"];

const missing = requiredPackages.filter((name) => {
  try {
    require.resolve(name);
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  console.error(
    `[pickhome] Missing npm packages: ${missing.join(", ")}. Run: npm install`,
  );
  process.exit(1);
}
