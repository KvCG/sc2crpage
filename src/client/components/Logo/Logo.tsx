import styles from './Logo.module.css'
import logo from '../../assets/Sc2.png'
export const Logo = () => {
    return <img src={logo} className={styles.logo} alt="" />
}
