// Patch for Node 25 removal of SlowBuffer for buffer-equal-constant-time dependency
if (typeof Buffer !== 'undefined' && !(Buffer as any).SlowBuffer) {
  (Buffer as any).SlowBuffer = Buffer;
}
if (typeof global !== 'undefined' && !(global as any).SlowBuffer) {
  (global as any).SlowBuffer = Buffer;
  // It also accesses SlowBuffer.prototype.equal
  if (!(global as any).SlowBuffer.prototype) {
      (global as any).SlowBuffer.prototype = {};
  }
  if (!(global as any).SlowBuffer.prototype.equal) {
      (global as any).SlowBuffer.prototype.equal = Buffer.prototype.equals;
  }
}
