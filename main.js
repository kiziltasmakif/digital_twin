import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202025);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(2, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
light1.position.set(5, 5, 5);
scene.add(light1);

const light2 = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(light2);

const loader = new GLTFLoader();

// Basit renklendirme yardımcısı: tekli veya çoklu materyalde rengi günceller.
function tintMaterial(material, hexColor) {
  const apply = (mat) => {
    if (mat && mat.color) {
      mat.color.setHex(hexColor);
      if (mat.emissive) {
        mat.emissive.setHex(hexColor).multiplyScalar(0.1);
      }
    }
  };
  if (Array.isArray(material)) {
    material.forEach(apply);
  } else {
    apply(material);
  }
}

function tintObject(obj, hexColor) {
  obj.traverse((child) => {
    if (child.isMesh && child.material) {
      tintMaterial(child.material, hexColor);
    }
  });
}

let door; // Kapı objesi (model yüklenince atanacak)
let doorPivot; // Kapıyı menteşeden döndürmek için pivot
let doorTargetRotation = 0; // Hedef rota (radyan, z ekseninde)
const doorOpenRotation = Math.PI / 2; // 90° aç
const doorNameHint =
  'Doors_GEALAN_S9000_Front-Door_Doors_GEALAN_S9000_Front-Door_435698';

loader.load(
  './model.glb',
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.6));
    camera.lookAt(center);
    controls.update();

    // İsteğe bağlı renklendirme örneği: isimlerde "Door", "Wall" vb. arar.
    const walls = model.getObjectByName('Wall') || model.getObjectByName('Walls');
    if (walls) tintObject(walls, 0xb0bec5); // açık gri

    const floor = model.getObjectByName('Floor');
    if (floor) tintObject(floor, 0x8d6e63); // ahşap ton

    // Kapıyı bul: isimde "door" geçen ilk mesh de olur
    door =
      model.getObjectByName('Door') ||
      model.getObjectByName('door') ||
      model.getObjectByName(doorNameHint) ||
      model.getObjectByProperty('name', (n) =>
        typeof n === 'string' ? n.toLowerCase().includes('door') : false
      );

    if (!door) {
      // Modeldeki isimleri konsola yaz, kullanıcı doğru adı bize verebilsin.
      const names = [];
      model.traverse((c) => {
        if (c.name) names.push(c.name);
      });
      console.warn(
        'Kapı objesi bulunamadı. Kapı ismini "Door" yapın ya da şu listeden doğru ismi söyleyin:',
        names
      );
    }

    if (door) {
      tintObject(door, 0x9c661f); // kapıya sıcak kahverengi ton
      // Hinge/pivot ayarı: kapıyı menteşesinden döndürmek için pivot ekle
      const doorBox = new THREE.Box3().setFromObject(door);
      const doorCenter = doorBox.getCenter(new THREE.Vector3());
      // Z sabit, XY düzleminde dönsün: hinge sol alt köşe merkez yüksekliği
      const hinge = new THREE.Vector3(
        doorBox.min.x,
        doorCenter.y,
        doorCenter.z
      );

      doorPivot = new THREE.Object3D();
      doorPivot.position.copy(hinge);
      scene.add(doorPivot);

      // Dünya matrisini koruyarak kapıyı pivot altına al (tilt bozulmasın)
      doorPivot.attach(door);
      doorPivot.rotation.set(0, 0, 0);

      // UI butonlarını bağla
      const openBtn = document.getElementById('open-door');
      const closeBtn = document.getElementById('close-door');
      if (openBtn && closeBtn) {
        openBtn.onclick = () => {
          doorTargetRotation = doorOpenRotation;
        };
        closeBtn.onclick = () => {
          doorTargetRotation = 0;
        };
      }
    } else {
      console.warn('Kapı objesi bulunamadı. Kapı ismini "Door" olarak ayarlayın.');
    }
  },
  (progress) => {
    if (progress.total) {
      console.log(
        `Yükleniyor: ${((progress.loaded / progress.total) * 100).toFixed(1)}%`
      );
    } else {
      console.log(`Yüklendi: ${progress.loaded} bayt`);
    }
  },
  (error) => {
    console.error('Model yüklenirken hata:', error);
  }
);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Kapı animasyonu: hedef rotasyona yumuşak geçiş
  if (doorPivot) {
    doorPivot.rotation.z = THREE.MathUtils.lerp(
      doorPivot.rotation.z,
      doorTargetRotation,
      0.12
    );
  }

  renderer.render(scene, camera);
}
animate();

// Boşluk tuşu ile kapıyı aç/kapat
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && door) {
    doorTargetRotation =
      Math.abs(doorTargetRotation - doorOpenRotation) < 1e-3
        ? 0
        : doorOpenRotation;
  }
});

