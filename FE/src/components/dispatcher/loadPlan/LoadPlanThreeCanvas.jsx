'use client';
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export function LoadPlanThreeCanvas({
  truck,
  visibleBlocks = [],
  stopPaletteMap = {},
  selectedBlockId,
  setSelectedBlockId,
  onResetViewRef
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const meshesMapRef = useRef(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 740;
    const height = container.clientHeight || 420;

    // 1. Tạo Scene & Phông nền sáng tương phản cao
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Nền xám xanh sáng làm nổi khối
    sceneRef.current = scene;

    // 2. Camera phối cảnh góc nhìn sắc nét
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 5000);
    cameraRef.current = camera;

    // 3. Renderer WebGL cấu hình siêu sắc nét (Ultra High-DPI & Anti-aliasing)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    // Sử dụng tỷ lệ điểm ảnh chuẩn sắc nét của màn hình (hỗ trợ màn Retina / 2K / 4K không bị mờ rỗ)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Hệ thống chiếu sáng studio 3 điểm (Three-Point Studio Lighting) làm nổi góc cạnh
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    // Đèn chính (Key Light) tạo bóng đổ và nổi khối
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(500, 700, 500);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    // Đèn phụ (Fill Light) làm rõ góc tối
    const dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    dirLight2.position.set(-500, 400, -300);
    scene.add(dirLight2);

    // Đèn viền (Rim Light) đánh sáng mép thùng xe
    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight3.position.set(0, 300, -600);
    scene.add(dirLight3);

    // 5. Thùng xe & Khung bao (Wireframe + Sàn xe)
    // Hệ tọa độ Three.js: X = Rộng (width), Y = Cao (height), Z = Dài (length)
    const tL = Number(truck?.length_cm) || 420;
    const tW = Number(truck?.width_cm) || 190;
    const tH = Number(truck?.height_cm) || 190;

    // Nhóm đối tượng xe tải để dễ căn tâm
    const truckGroup = new THREE.Group();
    scene.add(truckGroup);

    // Sàn thùng xe (Grid & Plane)
    const floorGeo = new THREE.PlaneGeometry(tL, tW);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = Math.PI / 2;
    floorMesh.position.set(0, 0, 0);
    truckGroup.add(floorMesh);

    // Đường lưới sàn thùng
    const gridHelper = new THREE.GridHelper(Math.max(tL, tW), Math.round(Math.max(tL, tW) / 50), 0x94a3b8, 0xcbd5e1);
    gridHelper.position.set(0, 0.2, 0);
    truckGroup.add(gridHelper);

    // Khung viền thùng xe (Dashed wireframe bao quanh không gian chứa hàng)
    const boxGeo = new THREE.BoxGeometry(tL, tH, tW);
    const wireGeo = new THREE.EdgesGeometry(boxGeo);
    const wireMat = new THREE.LineDashedMaterial({
      color: 0x475569,
      dashSize: 10,
      gapSize: 6,
      linewidth: 1.5
    });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    wireMesh.computeLineDistances();
    wireMesh.position.set(0, tH / 2, 0);
    truckGroup.add(wireMesh);

    // Vách đầu xe (Phía trước Cabin)
    const frontWallGeo = new THREE.PlaneGeometry(tW, tH);
    const frontWallMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const frontWall = new THREE.Mesh(frontWallGeo, frontWallMat);
    frontWall.rotation.y = Math.PI / 2;
    frontWall.position.set(-tL / 2, tH / 2, 0);
    truckGroup.add(frontWall);

    // Nhãn 3D "Đầu xe (Cabin)" và "Cửa sau bốc xếp"
    const createTextCanvasSprite = (text, bgColor = '#0f172a', textColor = '#ffffff') => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 12);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(60, 15, 1);
      return sprite;
    };

    const frontLabel = createTextCanvasSprite('◄ Đầu xe (Cabin)', '#1e293b');
    frontLabel.position.set(-tL / 2 - 40, 15, 0);
    truckGroup.add(frontLabel);

    const backLabel = createTextCanvasSprite('Cửa sau bốc xếp ►', '#0284c7');
    backLabel.position.set(tL / 2 + 40, 15, 0);
    truckGroup.add(backLabel);

    // 6. Camera Orbit đơn giản mượt mà (Mouse Drag & Wheel Zoom)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: Math.max(tL, tW, tH) * 2.2, theta: Math.PI / 4, phi: Math.PI / 3.2 };

    const updateCameraPos = () => {
      const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      const y = spherical.radius * Math.cos(spherical.phi);
      const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.position.set(x, y + tH / 3, z);
      camera.lookAt(0, tH / 3, 0);
    };
    updateCameraPos();

    const resetView = () => {
      spherical = { radius: Math.max(tL, tW, tH) * 2.2, theta: Math.PI / 4, phi: Math.PI / 3.2 };
      updateCameraPos();
    };

    if (onResetViewRef) {
      onResetViewRef.current = resetView;
    }

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.007;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.007));
      updateCameraPos();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(Math.max(tL, tW, tH) * 0.8, Math.min(Math.max(tL, tW, tH) * 4.5, spherical.radius + e.deltaY * 0.8));
      updateCameraPos();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Click Raycaster để chọn kiện hàng trực tiếp trên 3D
    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();

    const onClick = (e) => {
      const rect = dom.getBoundingClientRect();
      mouseCoord.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoord.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseCoord, camera);
      const meshes = Array.from(meshesMapRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        if (hitMesh.userData?.blockId && setSelectedBlockId) {
          setSelectedBlockId(hitMesh.userData.blockId);
        }
      }
    };
    dom.addEventListener('click', onClick);

    // Render loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 740;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [truck?.length_cm, truck?.width_cm, truck?.height_cm]);

  // Vẽ các khối kiện hàng 3D khi visibleBlocks hoặc selectedBlockId thay đổi
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Xóa các kiện hàng cũ
    meshesMapRef.current.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    });
    meshesMapRef.current.clear();

    const tL = Number(truck?.length_cm) || 420;
    const tW = Number(truck?.width_cm) || 190;

    // Tạo texture số thứ tự siêu nét (512x512 High-Res Canvas) cho mặt trên của kiện hàng
    const createPackageTexture = (indexStr, baseHex) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Nền mặt kiện
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 512, 512);

      // Viền kép nổi khối sắc nét
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 16;
      ctx.strokeRect(10, 10, 492, 492);

      // Nhãn số thứ tự kiện
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 120px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${indexStr}`, 256, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 16;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    };

    visibleBlocks.forEach((b) => {
      const isSelected = selectedBlockId === b.id;
      // Ưu tiên màu theo Loại hàng hóa (b.palette), nếu không có fallback theo điểm dừng
      const cargoColor = b.palette?.color || b.palette?.sideColor;
      const stopInfo = stopPaletteMap[b.stopId] || { color: '#86efac' };
      const baseColor = cargoColor || stopInfo.color || '#86efac';

      const shapeType = b.shapeType || 'BOX';
      let mesh = null;
      let edgeGeo = null;

      // dx: Chiều dài theo trục X thùng xe (Z trong Three.js)
      // dy: Chiều rộng theo trục Y thùng xe (X trong Three.js)
      // dz: Chiều cao theo trục Z thùng xe (Y trong Three.js)

      if (shapeType === 'CYLINDER' || shapeType === 'DRUM') {
        // Hàng cuộn tròn hoặc phuy tròn: bán kính lấy theo min(dx, dy)/2, chiều cao là dz
        const radius = Math.min(b.dx, b.dy) / 2 * 0.95;
        const height = b.dz;
        const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 24);

        const cylMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(isSelected ? '#f97316' : baseColor),
          roughness: 0.35,
          metalness: 0.25
        });

        mesh = new THREE.Mesh(cylGeo, cylMat);
        edgeGeo = new THREE.EdgesGeometry(cylGeo, 30);
      } else if (shapeType === 'BULK_MOUND') {
        // Hàng rời / hàng xao: hình dạng khối đống (Cone hoặc Dodecahedron bo góc)
        const radius = Math.min(b.dx, b.dy) / 2;
        const moundGeo = new THREE.ConeGeometry(radius, b.dz, 16);
        const moundMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(isSelected ? '#f97316' : '#78716c'),
          roughness: 0.9,
          metalness: 0.05
        });

        mesh = new THREE.Mesh(moundGeo, moundMat);
        edgeGeo = new THREE.EdgesGeometry(moundGeo, 25);
      } else {
        // Hàng thùng / Pallet hình chữ nhật tiêu chuẩn (BOX)
        const geo = new THREE.BoxGeometry(b.dx, b.dz, b.dy);
        const topTexture = createPackageTexture(String(b.packageIndex).padStart(2, '0'), isSelected ? '#fed7aa' : baseColor);
        const sideMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(isSelected ? '#f97316' : baseColor),
          roughness: 0.4,
          metalness: 0.1
        });
        const topMat = new THREE.MeshStandardMaterial({
          map: topTexture,
          roughness: 0.3
        });

        const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
        mesh = new THREE.Mesh(geo, materials);
        edgeGeo = new THREE.EdgesGeometry(geo);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Căn tọa độ từ góc (0,0,0) thùng xe sang tâm Three.js Group
      const posX = -tL / 2 + b.x + b.dx / 2;
      const posY = b.z + b.dz / 2;
      const posZ = -tW / 2 + b.y + b.dy / 2;

      mesh.position.set(posX, posY, posZ);
      mesh.userData = { blockId: b.id };

      // Viền cạnh nổi khối
      if (edgeGeo) {
        const edgeMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x9a3412 : 0x1e293b,
          linewidth: isSelected ? 2 : 1
        });
        const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
        mesh.add(edgeMesh);
      }

      scene.add(mesh);
      meshesMapRef.current.set(b.id, mesh);
    });
  }, [visibleBlocks, selectedBlockId, truck?.length_cm, truck?.width_cm, stopPaletteMap]);

  return (
    <div className="relative w-full h-[410px] rounded-lg overflow-hidden bg-slate-100 border border-slate-300 shadow-inner">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" />
      <div className="absolute bottom-2.5 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-md text-xs text-slate-800 font-medium shadow-sm border border-slate-300 flex items-center gap-2.5 pointer-events-none">
        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
          🖱️ Kéo chuột xoay 360° · Cuộn chuột thu phóng
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-indigo-700 font-bold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Three.js Ultra-HD WebGL
        </span>
      </div>
    </div>
  );
}

