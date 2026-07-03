/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@caliber/shared'],
  webpack: (config) => {
    // @caliber/shared uses NodeNext-style `.js` extensions in its relative
    // imports; let webpack resolve those to the `.ts` sources when bundling.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
