Blimy
=====

Blimy is a fork of the Athas code editor (https://github.com/athasdev/athas),
copyright the Athas contributors, licensed under the GNU Affero General Public
License version 3. Blimy is an independent downstream distribution and is not
affiliated with or endorsed by the Athas project.

Athas itself is distributed under the same license, so the full terms that
govern this work are the ones in LICENSE. In short, if you run a modified
version of this program as a network service, you must offer its source to
those users.

What changed here
-----------------

Blimy is rebranded from Athas and carries substantial changes, starting with a
client-side spend budget for built-in agent turns. Direct AI providers report
token counts but no cost, so a turn using your own API key had no way to report
what it spent or to stop itself. Blimy meters usage from a local price table
and stops a turn once it passes a budget you set.

Prices in src/features/ai/cost/model-prices.ts are hand-entered and dated there;
nothing fetches them at runtime.
