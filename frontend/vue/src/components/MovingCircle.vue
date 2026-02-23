<template>
  <div ref="containerRef" :class="['mc-surface', { 'mc-surface--fullscreen': !boundToParent }]">
    <div class="mc-circle" :style="{
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: color,
      left: `${position}px`,
    }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import './MovingCircle.css';

interface Props {
  size: number;
  speed: number;
  color: string;
  boundToParent?: boolean;
  resetToken?: number | string;
  shouldStop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  boundToParent: false,
  isPlaying: false,
});

enum Direction {
  Right = 1,
  Left = -1
}

const containerRef = ref<HTMLDivElement | null>(null);
const position = ref(0);
const containerWidth = ref(0);

let movementDirection = Direction.Right;
let prevFrameTime: number | null = null;
let animationId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let isPaused = true;

const emit = defineEmits<{
  (e: 'bounce'): void;
}>();

const bounce = (deltaTime: number) => {
  const maxPosition = Math.max(0, containerWidth.value - props.size);

  let nextPosition = position.value + (movementDirection * props.speed * deltaTime);
  let hitBoundary = false;

  if (nextPosition <= 0) {
    nextPosition = 0;
    movementDirection = Direction.Right;
    hitBoundary = true;
  } else if (nextPosition >= maxPosition) {
    nextPosition = maxPosition;
    movementDirection = Direction.Left;
    hitBoundary = true;
  }

  if (hitBoundary) {
    emit('bounce');
    if (props.shouldStop) {
      isPaused = true;
    }
  }

  position.value = nextPosition;
}

const animate = (time: number) => {
  if (prevFrameTime === null) {
    prevFrameTime = time;
    animationId = requestAnimationFrame(animate);
    return;
  }

  if (isPaused && !props.shouldStop) {
    isPaused = false;
  }

  if (!isPaused) {
    const deltaTime = (time - prevFrameTime) / 1000;
    bounce(deltaTime);
  }

  prevFrameTime = time;
  animationId = requestAnimationFrame(animate);
};

const handleWindowResize = () => {
  containerWidth.value = window.innerWidth;
};

onMounted(() => {
  if (props.boundToParent) {
    if (containerRef.value) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerWidth.value = entry.contentRect.width;
        }
      });
      resizeObserver.observe(containerRef.value);
      containerWidth.value = containerRef.value.clientWidth;
    }
  } else {
    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);
  }

  animationId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  window.removeEventListener("resize", handleWindowResize);
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
});

watch(() => props.resetToken, (newToken) => {
  if (newToken === undefined) {
    return;
  }

  position.value = 0;
  movementDirection = 1;
  prevFrameTime = null;
});
</script>