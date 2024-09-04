import styles from './Logo.module.css'
import logoZ from '../../assets/Zerg.png'
import logoT from '../../assets/Terran.png'
import logoP from '../../assets/Protoss.png'

export const Logo = () => {
    return (
        <div>
            <img src={logoZ} className={styles.logo} alt="" />
            <img src={logoT} className={styles.logo} alt="" />
            <img src={logoP} className={styles.logo} alt="" />
        </div>
    )
}
