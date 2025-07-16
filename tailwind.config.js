/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            code: {
              "&::before, &::after": {
                display: "none",
              },
            },
          },
        },
      },
    },
  },
};
