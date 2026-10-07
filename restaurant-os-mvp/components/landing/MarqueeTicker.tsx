"use client";

const foodIcons = [
  "/assets/food/pizza.png",
  "/assets/food/coffee.png",
  "/assets/food/cupcake.png",
  "/assets/food/salad.png",
  "/assets/food/icecream.png",
  "/assets/food/croissant.png",
  "/assets/food/sushi.png",
  "/assets/food/donut.png",
  "/assets/food/chicken.png",
  "/assets/food/hotdog.png",
  "/assets/food/apple.png",
];

const MarqueeTicker = () => (
  <div className="w-full py-3 overflow-hidden bg-white/40 dark:bg-black/20 backdrop-blur-sm border-y border-neutral-200/50 dark:border-neutral-800/50">
    <div className="marquee-track flex w-max">
      {[0, 1].map((set) => (
        <div key={set} className="flex items-center gap-8 px-4 shrink-0 animate-marquee">
          {[...foodIcons, ...foodIcons, ...foodIcons].map((src, i) => (
            <img
              key={`${set}-${i}`}
              src={src}
              alt=""
              className="w-8 h-8 object-contain drop-shadow-md"
              draggable={false}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default MarqueeTicker;
